import { spawnSync } from 'node:child_process';

const DEFAULT_REMOTE = 'origin';

const args = process.argv.slice(2);

const options = {
  remote: DEFAULT_REMOTE,
  branch: '',
  message: '',
  build: true,
  trackedOnly: false,
  dryRun: false,
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

  if (!options.message) {
    options.message = arg;
  }
}

const quoteWindowsShellArg = (value) => {
  const stringValue = String(value);
  if (!/[()\s&|<>^"]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '\\"')}"`;
};

const createSpawnCommand = (command, commandArgs) => {
  if (process.platform === 'win32' && command === 'npm') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [command, ...commandArgs].map(quoteWindowsShellArg).join(' ')],
    };
  }

  return {
    command,
    args: commandArgs,
  };
};

const run = (command, commandArgs, { capture = false, allowFailure = false } = {}) => {
  const renderedCommand = [command, ...commandArgs].join(' ');
  console.log(`$ ${renderedCommand}`);

  if (options.dryRun && !capture) {
    return '';
  }

  const spawnCommand = createSpawnCommand(command, commandArgs);
  const result = spawnSync(spawnCommand.command, spawnCommand.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env:
      command === 'git'
        ? {
            ...process.env,
            GIT_PAGER: 'cat',
            GIT_TERMINAL_PROMPT: '0',
          }
        : process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = capture ? result.stderr?.trim() : '';
    throw new Error(stderr || `${renderedCommand} failed with exit code ${result.status}`);
  }

  if (capture) {
    return result.stdout.trim();
  }

  return '';
};

const hasChanges = (argsForDiff) => {
  const spawnCommand = createSpawnCommand('git', argsForDiff);
  const result = spawnSync(spawnCommand.command, spawnCommand.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'ignore',
  });

  return result.status !== 0;
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

try {
  const isRepo = run('git', ['rev-parse', '--is-inside-work-tree'], { capture: true });
  if (isRepo !== 'true') {
    throw new Error('This command must be run inside a Git repository.');
  }

  const branch = options.branch || run('git', ['branch', '--show-current'], { capture: true });
  if (!branch) {
    throw new Error('Current Git state is detached. Pass --branch <name> or checkout a branch first.');
  }

  run('git', ['remote', 'get-url', options.remote], { capture: true });

  if (options.build) {
    run('npm', ['run', 'build']);
  }

  run('git', ['diff', '--check']);

  const statusBeforeStage = run('git', ['status', '--short'], { capture: true });
  if (statusBeforeStage) {
    console.log('Staging repository changes...');
    run('git', options.trackedOnly ? ['add', '-u'] : ['add', '-A']);
  } else {
    console.log('No local changes to stage.');
  }

  if (hasChanges(['diff', '--cached', '--quiet'])) {
    const message = options.message || `chore: deploy to github ${currentTimestamp()}`;
    run('git', ['commit', '-m', message]);
  } else {
    console.log('No staged changes to commit.');
  }

  run('git', ['fetch', options.remote, branch]);

  const remoteRef = `${options.remote}/${branch}`;
  const remoteExists = run('git', ['rev-parse', '--verify', remoteRef], {
    capture: true,
    allowFailure: true,
  });

  if (remoteExists) {
    const counts = run('git', ['rev-list', '--left-right', '--count', `${branch}...${remoteRef}`], {
      capture: true,
    });
    const [ahead = '0', behind = '0'] = counts.split(/\s+/);

    if (Number(behind) > 0) {
      run('git', ['pull', '--rebase', options.remote, branch]);
    }

    if (Number(ahead) === 0 && Number(behind) === 0) {
      console.log('Local branch is already in sync with GitHub.');
    }
  }

  run('git', ['push', '-u', options.remote, branch]);
  console.log(`GitHub deployment completed on ${options.remote}/${branch}.`);
} catch (error) {
  console.error(`GitHub deployment failed: ${error.message}`);
  process.exitCode = 1;
}
