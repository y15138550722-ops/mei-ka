$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$logDir = Join-Path $repoRoot 'temp\scheduled-deploy'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "weekly-github-deploy-$timestamp.log"

Start-Transcript -Path $logFile -Append | Out-Null

try {
  Set-Location $repoRoot

  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }

  if (-not $npmCommand) {
    throw 'npm was not found in PATH. Install Node.js or add npm to PATH before the scheduled task runs.'
  }

  $env:GIT_TERMINAL_PROMPT = '0'
  $env:CI = 'true'

  & $npmCommand.Source run deploy:git -- -m 'chore: weekly github deploy'

  if ($LASTEXITCODE -ne 0) {
    throw "npm run deploy:git failed with exit code $LASTEXITCODE"
  }
} finally {
  Stop-Transcript | Out-Null
}
