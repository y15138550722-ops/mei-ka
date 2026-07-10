import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const npmCli = process.env.npm_execpath;
const workspaceCache = path.join(root, ".npm-cache");
const workspaceGlobalConfig = path.join(
  root,
  ".vercel-cli-home",
  "com.vercel.cli",
  "Data"
);
const extraArgs = process.argv.slice(2);
const skipLocalPrep =
  process.env.VERCEL_SKIP_LOCAL_PREP === "1" ||
  process.env.npm_lifecycle_event === "deploy:vercel";

function stripDeadProxyVars(sourceEnv) {
  const nextEnv = { ...sourceEnv };
  const proxyKeys = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "GIT_HTTP_PROXY",
    "GIT_HTTPS_PROXY",
  ];

  for (const key of proxyKeys) {
    const value = nextEnv[key];
    if (value && /127\.0\.0\.1:9\b/.test(value)) {
      delete nextEnv[key];
    }
  }

  return nextEnv;
}

const env = {
  ...stripDeadProxyVars(process.env),
  NO_UPDATE_NOTIFIER: "1",
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || workspaceCache,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(result.error.code === "ENOENT" ? 127 : 1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(args, options = {}) {
  if (npmCli && existsSync(npmCli)) {
    run(process.execPath, [npmCli, ...args], options);
    return;
  }

  run(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    shell: process.platform === "win32",
    ...options,
  });
}

function findVercelCli() {
  const jsCandidates = [
    process.env.VERCEL_CLI_JS,
    path.join(root, ".npm-global", "node_modules", "vercel", "dist", "index.js"),
    path.join(root, "node_modules", "vercel", "dist", "index.js"),
  ].filter(Boolean);

  const jsEntry = jsCandidates.find((candidate) => existsSync(candidate));
  if (jsEntry) {
    return { command: process.execPath, args: [jsEntry] };
  }

  const binCandidates = [
    process.env.VERCEL_CLI,
    path.join(root, ".npm-global", process.platform === "win32" ? "vercel.cmd" : "vercel"),
    path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vercel.cmd" : "vercel"),
  ].filter(Boolean);

  const binEntry = binCandidates.find((candidate) => existsSync(candidate));
  return binEntry
    ? { command: binEntry, args: [], shell: process.platform === "win32" }
    : null;
}

function buildVercelArgs() {
  const args = ["deploy", "--prod", "--yes"];

  if (existsSync(path.join(workspaceGlobalConfig, "auth.json"))) {
    args.push("--global-config", workspaceGlobalConfig);
  }

  return [...args, ...extraArgs];
}

if (skipLocalPrep) {
  console.log("Using npm predeploy:vercel checks and build.");
} else {
  console.log("Running Vercel deployment checks...");
  run(process.execPath, [path.join(root, "scripts", "check-vercel-deploy.mjs")]);

  console.log("Building production bundle...");
  runNpm(["run", "build"], { cwd: srcDir });
}

console.log("Deploying to Vercel production...");
const vercelCli = findVercelCli();
const vercelArgs = buildVercelArgs();

if (vercelCli) {
  run(vercelCli.command, [...vercelCli.args, ...vercelArgs], {
    shell: vercelCli.shell || false,
  });
} else {
  runNpm([
    "exec",
    "--yes",
    "--cache",
    workspaceCache,
    "--package",
    "vercel@52.0.0",
    "--",
    "vercel",
    ...vercelArgs,
  ]);
}

if (process.env.VERCEL_SKIP_VERIFY !== "1") {
  console.log("Verifying production URL...");
  run(process.execPath, [path.join(root, "scripts", "verify-vercel.mjs")]);
}
