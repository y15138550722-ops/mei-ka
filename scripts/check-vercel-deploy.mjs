import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedProject = process.env.VERCEL_PROJECT_NAME || "meika-admin-demo-20260408";
const expectedDomain =
  process.env.VERCEL_PRODUCTION_DOMAIN || `${expectedProject}.vercel.app`;
const allowedEmails = (
  process.env.VERCEL_ALLOWED_GIT_EMAILS || "y15138550722@gmail.com"
)
  .split(/[,\s;]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const errors = [];
const warnings = [];
const strictGitChecks = process.env.VERCEL_STRICT_GIT === "1";

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    const stdout = error.stdout ? String(error.stdout).trim() : "";
    throw new Error(stderr || stdout || error.message);
  }
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    errors.push(`Missing ${relativePath}.`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function reportGitIssue(message) {
  if (strictGitChecks) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}

function assertAllowedEmail(label, email, { fatal = true } = {}) {
  const normalized = (email || "").toLowerCase();
  if (!allowedEmails.includes(normalized)) {
    const message = `${label} is "${email || "(empty)"}", but Vercel production deploys normally use one of: ${allowedEmails.join(", ")}.`;
    if (fatal) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }
}

function describeGitReadFailure(label, error) {
  return `${label}: ${error.message}. Direct Vercel CLI deploys can continue, but Git auto-deploy checks were skipped.`;
}

function assertGitEmail(label, email) {
  assertAllowedEmail(label, email, { fatal: strictGitChecks });
}

function assertGitValue(label, value) {
  if (!value) {
    reportGitIssue(
      `${label} is not set. Direct Vercel CLI deploys can continue, but Git auto-deploy metadata is incomplete.`
    );
  }
}

console.log("Checking Vercel deployment prerequisites...");

const project = readJson(".vercel/project.json");
if (project) {
  if (project.projectName !== expectedProject) {
    errors.push(
      `.vercel/project.json is linked to "${project.projectName}", expected "${expectedProject}".`
    );
  }
  if (!project.projectId || !project.orgId) {
    errors.push(".vercel/project.json must contain projectId and orgId.");
  }
}

const vercelConfig = readJson("vercel.json");
if (vercelConfig) {
  const expectedSettings = {
    buildCommand: "npm run build",
    installCommand: "cd src && npm ci",
    outputDirectory: "src/dist",
  };

  for (const [key, value] of Object.entries(expectedSettings)) {
    if (vercelConfig[key] !== value) {
      errors.push(`vercel.json ${key} must be "${value}".`);
    }
  }

  if (!Array.isArray(vercelConfig.rewrites) || vercelConfig.rewrites.length === 0) {
    warnings.push("vercel.json has no SPA rewrite; deep links may 404.");
  }
}

if (!existsSync(path.join(root, "src/package-lock.json"))) {
  errors.push("Missing src/package-lock.json; Vercel install uses npm ci.");
}

try {
  const localEmail = run("git", ["config", "--local", "--get", "user.email"]);
  assertGitEmail("Local git user.email", localEmail);
} catch (error) {
  reportGitIssue(describeGitReadFailure("Unable to read local git user.email", error));
}

try {
  const localName = run("git", ["config", "--local", "--get", "user.name"]);
  assertGitValue("Local git user.name", localName);
} catch (error) {
  reportGitIssue(describeGitReadFailure("Unable to read local git user.name", error));
}

try {
  const headEmail = run("git", ["show", "-s", "--format=%ae", "HEAD"]);
  assertGitEmail("HEAD commit author email", headEmail);
} catch (error) {
  reportGitIssue(describeGitReadFailure("Unable to read HEAD commit author", error));
}

try {
  const branch = run("git", ["branch", "--show-current"]);
  if (branch !== "main") {
    warnings.push(`Current branch is "${branch}", while production deploys normally come from "main".`);
  }
} catch (error) {
  warnings.push(`Unable to read current branch: ${error.message}`);
}

try {
  const status = run("git", ["status", "--porcelain"]);
  if (status) {
    warnings.push("Working tree has uncommitted changes. Commit and push before relying on Git auto-deploy.");
  }
} catch (error) {
  warnings.push(`Unable to read git status: ${error.message}`);
}

try {
  const origin = run("git", ["remote", "get-url", "origin"]);
  if (!origin.includes("github.com/y15138550722-ops/mei-ka")) {
    warnings.push(`origin remote is "${origin}". Expected the mei-ka GitHub repository.`);
  }
} catch (error) {
  warnings.push(`Unable to read origin remote: ${error.message}`);
}

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (errors.length > 0) {
  console.error("\nVercel deployment check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  if (strictGitChecks) {
    console.error("\nRecommended local fix:");
    console.error('  git config user.name "y15138550722"');
    console.error('  git config user.email "y15138550722@gmail.com"');
    console.error('  git commit --allow-empty -m "Trigger Vercel production deploy"');
    console.error("  git push origin main");
  }
  process.exit(1);
}

console.log(`OK: Vercel project ${expectedProject} is ready for ${expectedDomain}.`);
