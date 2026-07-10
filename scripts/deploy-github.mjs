import { spawnSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REMOTE = 'origin';
const STALE_LOCK_AGE_MS = 10 * 60 * 1000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let gitContext = {
  workTree: root,
  gitDir: '',
  tempBase: '',
};
let buildCompleted = false;

const options = {
  remote: DEFAULT_REMOTE,
  branch: '',
  message: '',
  build: true,
  trackedOnly: false,
  dryRun: false,
  safeCopy: false,
  syncDefaultBranch: true,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--remote') {
    options.remote = args[index + 1] || DEFAULT_REMOTE;
    index += 1;
    continue;
  }

  if (arg === '--branch') {
    options.branch = args[index + 1] || '';
    index += 1;
    continue;
  }

  if (arg === '--message' || arg === '-m') {
    options.message = args[index + 1] || '';
    index += 1;
    continue;
  }

  if (arg === '--no-build') {
    options.build = false;
    continue;
  }

  if (arg === '--tracked-only') {
    options.trackedOnly = true;
    continue;
  }

  if (arg === '--dry-run') {
    options.dryRun = true;
    continue;
  }

  if (arg === '--safe-copy') {
    options.safeCopy = true;
    continue;
  }

  if (arg === '--no-sync-default-branch') {
    options.syncDefaultBranch = false;
    continue;
  }

  if (!options.message) {
    options.message = arg;
  }
}

const stripDeadProxyVars = (sourceEnv) => {
  const nextEnv = { ...sourceEnv };
  const proxyKeys = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
    'GIT_HTTP_PROXY',
    'GIT_HTTPS_PROXY',
  ];

  for (const key of proxyKeys) {
    const value = nextEnv[key];
    if (value && /127\.0\.0\.1:9\b/.test(value)) {
      delete nextEnv[key];
    }
  }

  return nextEnv;
};

const gitEnv = () => ({
  ...stripDeadProxyVars(process.env),
  GIT_PAGER: 'cat',
  GIT_TERMINAL_PROMPT: '0',
});

const redactArg = (value) =>
  String(value).replace(/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/g, 'Authorization: Basic ***');

const renderCommand = (command, commandArgs) =>
  [path.basename(command), ...commandArgs.map(redactArg)].join(' ');

const quoteWindowsShellArg = (value) => {
  const stringValue = String(value);
  if (!/[()\s&|<>^"]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '\\"')}"`;
};

const commandWorks = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'ignore',
    env: gitEnv(),
  });

  return result.status === 0;
};

const resolveGitCommand = () => {
  const knownWindowsGit = 'D:\\\u8f6f\u4ef6\\Git\\Git\\cmd\\git.exe';
  const candidates = [
    process.env.GIT_EXE,
    process.platform === 'win32' && existsSync(knownWindowsGit) ? knownWindowsGit : '',
    'git',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (commandWorks(candidate, ['--version'])) {
      return candidate;
    }
  }

  throw new Error('Git was not found. Install Git or set GIT_EXE to git.exe.');
};

const gitCommand = resolveGitCommand();
let githubAuthArgs;
let githubRepoInfo;

const resolveGhCommand = () => {
  const candidates = [
    process.env.GH_EXE,
    'gh',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (commandWorks(candidate, ['--version'])) {
      return candidate;
    }
  }

  return '';
};

const ghCommand = resolveGhCommand();

const spawnWithFileCapture = (command, commandArgs, { cwd = root, env = process.env, input = '' } = {}) => {
  const captureDir = path.join(root, 'temp', '.deploy-captures');
  const captureId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const stdoutPath = path.join(captureDir, `${captureId}.out`);
  const stderrPath = path.join(captureDir, `${captureId}.err`);
  const stdinPath = path.join(captureDir, `${captureId}.in`);
  let stdinFd = 'ignore';
  let stdoutFd;
  let stderrFd;

  mkdirSync(captureDir, { recursive: true });

  if (input) {
    writeFileSync(stdinPath, input);
    stdinFd = openSync(stdinPath, 'r');
  }

  stdoutFd = openSync(stdoutPath, 'w+');
  stderrFd = openSync(stderrPath, 'w+');

  try {
    const result = spawnSync(command, commandArgs, {
      cwd,
      encoding: 'utf8',
      stdio: [stdinFd, stdoutFd, stderrFd],
      env,
    });

    if (typeof stdinFd === 'number') {
      closeSync(stdinFd);
      stdinFd = 'ignore';
    }
    closeSync(stdoutFd);
    stdoutFd = undefined;
    closeSync(stderrFd);
    stderrFd = undefined;

    return {
      ...result,
      stdout: readFileSync(stdoutPath, 'utf8'),
      stderr: readFileSync(stderrPath, 'utf8'),
    };
  } finally {
    if (typeof stdinFd === 'number') {
      closeSync(stdinFd);
    }
    if (typeof stdoutFd === 'number') {
      closeSync(stdoutFd);
    }
    if (typeof stderrFd === 'number') {
      closeSync(stderrFd);
    }
    rmSync(stdoutPath, { force: true });
    rmSync(stderrPath, { force: true });
    rmSync(stdinPath, { force: true });
  }
};

const runCommand = (
  command,
  commandArgs,
  { capture = false, allowFailure = false, cwd = root, env = process.env, input = '' } = {},
) => {
  const renderedCommand = renderCommand(command, commandArgs);
  console.log(`$ ${renderedCommand}`);

  if (options.dryRun && !capture) {
    return '';
  }

  const result = spawnWithFileCapture(command, commandArgs, { cwd, env, input });

  if (!capture) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `${renderedCommand} failed with exit code ${result.status}`);
  }

  return capture ? result.stdout.trim() : '';
};

const runGh = (commandArgs, { capture = false, allowFailure = false, input = '' } = {}) => {
  if (!ghCommand) {
    throw new Error('GitHub CLI was not found. Install gh or set GH_EXE.');
  }

  return runCommand(ghCommand, commandArgs, {
    capture,
    allowFailure,
    cwd: gitContext.workTree,
    env: stripDeadProxyVars(process.env),
    input,
  });
};

const runNpm = (commandArgs) => {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    runCommand(process.execPath, [process.env.npm_execpath, ...commandArgs], {
      env: stripDeadProxyVars(process.env),
    });
    return;
  }

  if (process.platform === 'win32') {
    runCommand(
      'cmd.exe',
      ['/d', '/s', '/c', ['npm', ...commandArgs].map(quoteWindowsShellArg).join(' ')],
      { env: stripDeadProxyVars(process.env) },
    );
    return;
  }

  runCommand('npm', commandArgs, { env: stripDeadProxyVars(process.env) });
};

const gitArgs = (commandArgs) =>
  gitContext.gitDir
    ? [`--git-dir=${gitContext.gitDir}`, `--work-tree=${gitContext.workTree}`, ...commandArgs]
    : commandArgs;

const runGit = (commandArgs, { capture = false, allowFailure = false, auth = false } = {}) => {
  const finalArgs = auth ? [...getGitHubAuthArgs(), ...gitArgs(commandArgs)] : gitArgs(commandArgs);
  return runCommand(gitCommand, finalArgs, {
    capture,
    allowFailure,
    cwd: gitContext.workTree,
    env: gitEnv(),
  });
};

const gitExitCode = (commandArgs) => {
  const result = spawnSync(gitCommand, gitArgs(commandArgs), {
    cwd: gitContext.workTree,
    encoding: 'utf8',
    stdio: 'ignore',
    env: gitEnv(),
  });

  return result.status ?? 1;
};

const currentTimestamp = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getGitHubAuthArgs = () => {
  if (githubAuthArgs) {
    return githubAuthArgs;
  }

  githubAuthArgs = [];

  const remoteUrl = runGit(['remote', 'get-url', options.remote], {
    capture: true,
    allowFailure: true,
  });

  if (!/github\.com[:/]/i.test(remoteUrl)) {
    return githubAuthArgs;
  }

  const result = spawnWithFileCapture(gitCommand, ['credential-manager', 'get'], {
    cwd: root,
    input: 'protocol=https\nhost=github.com\n\n',
    env: gitEnv(),
  });

  if (result.status !== 0) {
    console.warn('GitHub credential manager was not available; falling back to default Git auth.');
    return githubAuthArgs;
  }

  const credentialLines = result.stdout.split(/\r?\n/);
  const username = credentialLines
    .find((line) => line.startsWith('username='))
    ?.slice('username='.length);
  const password = credentialLines
    .find((line) => line.startsWith('password='))
    ?.slice('password='.length);

  if (!username || !password) {
    console.warn('GitHub credential manager did not return a complete credential.');
    return githubAuthArgs;
  }

  const basic = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  githubAuthArgs = ['-c', `http.extraHeader=Authorization: Basic ${basic}`];
  return githubAuthArgs;
};

const parseGitHubRepo = (remoteUrl) => {
  const normalized = remoteUrl.trim().replace(/\.git$/i, '');
  const match = normalized.match(/github\.com[:/]([^/]+\/[^/]+)$/i);
  return match ? match[1] : '';
};

const getGitHubRepoInfo = () => {
  if (githubRepoInfo) {
    return githubRepoInfo;
  }

  const remoteUrl = runGit(['remote', 'get-url', options.remote], {
    capture: true,
    allowFailure: true,
  });

  const nameWithOwner = parseGitHubRepo(remoteUrl);
  if (!nameWithOwner) {
    githubRepoInfo = null;
    return githubRepoInfo;
  }

  const defaultBranch =
    ghCommand
      ? JSON.parse(
          runGh(
            ['repo', 'view', nameWithOwner, '--json', 'defaultBranchRef,nameWithOwner'],
            { capture: true },
          ),
        ).defaultBranchRef?.name
      : 'main';

  githubRepoInfo = {
    nameWithOwner,
    defaultBranch: defaultBranch || 'main',
  };
  return githubRepoInfo;
};

const ensureGitIdentity = () => {
  const currentName = runGit(['config', '--local', '--get', 'user.name'], {
    capture: true,
    allowFailure: true,
  });
  const currentEmail = runGit(['config', '--local', '--get', 'user.email'], {
    capture: true,
    allowFailure: true,
  });

  if (currentName && currentEmail) {
    return;
  }

  let fallbackName = currentName;
  let fallbackEmail = currentEmail;

  if (ghCommand) {
    const authStatus = runGh(['auth', 'status'], { capture: true, allowFailure: true });
    if (authStatus) {
      const user = JSON.parse(runGh(['api', 'user', '--jq', '{login: .login, name: .name}'], { capture: true }));
      fallbackName = fallbackName || user.login || user.name || 'github-actions[bot]';
      fallbackEmail = fallbackEmail || `${user.login || 'github'}@users.noreply.github.com`;
    }
  }

  fallbackName = fallbackName || 'Codex';
  fallbackEmail = fallbackEmail || 'codex@local';

  if (!currentName) {
    runGit(['config', '--local', 'user.name', fallbackName]);
  }

  if (!currentEmail) {
    runGit(['config', '--local', 'user.email', fallbackEmail]);
  }
};

const syncDefaultBranchOnGitHub = (branch, headSha) => {
  if (!options.syncDefaultBranch || options.dryRun) {
    return;
  }

  const repoInfo = getGitHubRepoInfo();
  if (!repoInfo || branch === repoInfo.defaultBranch) {
    return;
  }

  const defaultRef = JSON.parse(
    runGh(['api', `repos/${repoInfo.nameWithOwner}/git/ref/heads/${repoInfo.defaultBranch}`], { capture: true }),
  );
  const defaultSha = defaultRef.object.sha;
  const headCommit = JSON.parse(
    runGh(['api', `repos/${repoInfo.nameWithOwner}/git/commits/${headSha}`], { capture: true }),
  );
  const mergeMessage = `chore: sync ${branch} into ${repoInfo.defaultBranch}`;
  const mergeCommit = JSON.parse(
    runGh([
      'api',
      `repos/${repoInfo.nameWithOwner}/git/commits`,
      '--method',
      'POST',
      '-f',
      `message=${mergeMessage}`,
      '-f',
      `tree=${headCommit.tree.sha}`,
      '-f',
      `parents[]=${defaultSha}`,
      '-f',
      `parents[]=${headSha}`,
    ], { capture: true }),
  );

  runGh([
    'api',
    `repos/${repoInfo.nameWithOwner}/git/refs/heads/${repoInfo.defaultBranch}`,
    '--method',
    'PATCH',
    '-f',
    `sha=${mergeCommit.sha}`,
    '-F',
    'force=false',
  ]);
};

const clearStaleIndexLock = () => {
  const gitDir = runGit(['rev-parse', '--git-dir'], { capture: true });
  const absoluteGitDir = path.isAbsolute(gitDir) ? gitDir : path.join(gitContext.workTree, gitDir);
  const lockPath = path.join(absoluteGitDir, 'index.lock');

  if (!existsSync(lockPath)) {
    return;
  }

  const lockAgeMs = Date.now() - statSync(lockPath).mtimeMs;
  if (lockAgeMs < STALE_LOCK_AGE_MS) {
    throw new Error(`Git index is locked by a recent process: ${lockPath}`);
  }

  console.warn(`Removing stale Git index lock: ${lockPath}`);
  rmSync(lockPath, { force: true });
};

const hasStagedChanges = () => gitExitCode(['diff', '--cached', '--quiet']) !== 0;

const getAheadBehind = (branch, remoteRef) => {
  const counts = runGit(['rev-list', '--left-right', '--count', `${branch}...${remoteRef}`], {
    capture: true,
  });
  const [ahead = '0', behind = '0'] = counts.split(/\s+/);
  return {
    ahead: Number(ahead),
    behind: Number(behind),
  };
};

const timestampForPath = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  ].join('-');
};

const normalizeRelativePath = (fromRoot, targetPath) =>
  path.relative(fromRoot, targetPath).replace(/\\/g, '/');

const shouldCopyWorktreePath = (sourcePath) => {
  const relativePath = normalizeRelativePath(root, sourcePath);
  if (!relativePath) {
    return true;
  }

  const firstSegment = relativePath.split('/')[0];
  const excludedTopLevel = new Set([
    '.git',
    '.tools',
    '.npm-cache',
    '.npm-global',
    '.vercel',
    '.vercel-cli-home',
    '.docx_tmp',
    '.tmp-docx-preview',
    'Configuration file',
    'build',
    'dist',
    'node_modules',
    'temp',
  ]);

  if (excludedTopLevel.has(firstSegment)) {
    return false;
  }

  const excludedNestedSegments = new Set([
    '.docx_tmp',
    '.npm-cache',
    '.npm-global',
    '.tmp-docx-preview',
    '.vercel',
    '.vercel-cli-home',
    'dist',
    'node_modules',
  ]);
  if (relativePath.split('/').some((segment) => excludedNestedSegments.has(segment))) {
    return false;
  }

  const baseName = path.basename(relativePath);
  const excludedFiles = new Set([
    '.tmp-docx-preview.zip',
    'enable-gh-global.cmd',
    'fix-gh-codex-status-admin.cmd',
    'gh.cmd',
    'recovery-codes.md',
  ]);

  if (excludedFiles.has(baseName)) {
    return false;
  }

  return !/^(dev-server|static-server|cloudflared-tunnel).*\.(err\.)?log$/i.test(baseName);
};

const shouldCopyGitPath = (sourcePath) => !path.basename(sourcePath).endsWith('.lock');

const createSafeCopyContext = () => {
  const tempRoot = process.env.MEIKA_GITHUB_DEPLOY_TMP || path.join(root, 'temp');
  const tempBase = path.join(tempRoot, `mei-ka-github-deploy-${timestampForPath()}`);
  const workTree = path.join(tempBase, 'work');
  const gitDir = path.join(tempBase, 'git-data');

  mkdirSync(tempBase, { recursive: true });
  mkdirSync(workTree, { recursive: true });
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const sourcePath = path.join(root, entry.name);
    if (!shouldCopyWorktreePath(sourcePath)) {
      continue;
    }

    cpSync(sourcePath, path.join(workTree, entry.name), {
      recursive: true,
      filter: shouldCopyWorktreePath,
    });
  }

  cpSync(path.join(root, '.git'), gitDir, {
    recursive: true,
    filter: shouldCopyGitPath,
  });

  return {
    workTree,
    gitDir,
    tempBase,
  };
};

const shouldRetryWithSafeCopy = (error) =>
  /index\.lock|Unable to create|could not write index|Permission denied|EPERM/i.test(error.message);

const switchToSafeCopyContext = () => {
  gitContext = createSafeCopyContext();
  githubAuthArgs = undefined;

  runGit(['reset', '--mixed', 'HEAD']);

  const branch = options.branch || runGit(['branch', '--show-current'], { capture: true });
  if (!branch) {
    return;
  }

  runGit(['fetch', options.remote, branch], { auth: true });
  const remoteRef = `${options.remote}/${branch}`;
  const remoteExists = runGit(['rev-parse', '--verify', remoteRef], {
    capture: true,
    allowFailure: true,
  });

  if (remoteExists) {
    runGit(['reset', '--mixed', remoteRef]);
  }
};

const deployOnce = () => {
  const isRepo = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true });
  if (isRepo !== 'true') {
    throw new Error('This command must be run inside a Git repository.');
  }

  clearStaleIndexLock();

  const branch = options.branch || runGit(['branch', '--show-current'], { capture: true });
  if (!branch) {
    throw new Error('Current Git state is detached. Pass --branch <name> or checkout a branch first.');
  }

  runGit(['remote', 'get-url', options.remote], { capture: true });
  ensureGitIdentity();

  if (options.build && !buildCompleted) {
    runNpm(['run', 'build']);
    buildCompleted = true;
  }

  runGit(['diff', '--check']);

  const statusBeforeStage = runGit(['status', '--short'], { capture: true });
  if (statusBeforeStage) {
    console.log('Staging repository changes...');
    runGit(options.trackedOnly ? ['add', '-u'] : ['add', '-A']);
  } else {
    console.log('No local changes to stage.');
  }

  if (hasStagedChanges()) {
    const message = options.message || `chore: deploy to github ${currentTimestamp()}`;
    runGit(['commit', '-m', message]);
  } else {
    console.log('No staged changes to commit.');
  }

  runGit(['push', '-u', options.remote, branch], { auth: true });
  const head = runGit(['rev-parse', '--short', 'HEAD'], { capture: true });
  const headFull = runGit(['rev-parse', 'HEAD'], { capture: true });
  syncDefaultBranchOnGitHub(branch, headFull);
  if (options.dryRun) {
    console.log(`GitHub deployment dry run completed for ${options.remote}/${branch} at ${head}.`);
  } else {
    console.log(`GitHub deployment completed on ${options.remote}/${branch} at ${head}.`);
  }
};

try {
  if (options.safeCopy) {
    switchToSafeCopyContext();
  }

  deployOnce();
} catch (error) {
  if (!gitContext.gitDir && shouldRetryWithSafeCopy(error)) {
    console.warn(`Direct Git deployment hit a local index issue: ${error.message}`);
    console.warn('Retrying from a temporary clean Git copy...');

    switchToSafeCopyContext();

    try {
      deployOnce();
      console.log(`Temporary Git copy used: ${gitContext.tempBase}`);
    } catch (safeCopyError) {
      console.error(`GitHub deployment failed: ${safeCopyError.message}`);
      process.exitCode = 1;
    }
  } else {
    console.error(`GitHub deployment failed: ${error.message}`);
    process.exitCode = 1;
  }
}
