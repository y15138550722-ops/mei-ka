$ErrorActionPreference = "Stop"

$profileDir = Join-Path $env:APPDATA "Antigravity\CachedProfilesData\__default__profile__"
$cacheFiles = @("extensions.builtin.cache", "extensions.user.cache")

Write-Host "Antigravity cache repair"
Write-Host "Profile cache folder: $profileDir"
Write-Host ""

$running = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Antigravity is currently running."
  Write-Host "Please close Antigravity completely, then run this script again."
  exit 1
}

if (!(Test-Path -LiteralPath $profileDir)) {
  Write-Host "Cache folder was not found. Nothing to repair."
  exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$changed = $false

foreach ($fileName in $cacheFiles) {
  $path = Join-Path $profileDir $fileName
  if (Test-Path -LiteralPath $path) {
    $backupPath = "$path.bak.$timestamp"
    Rename-Item -LiteralPath $path -NewName (Split-Path $backupPath -Leaf)
    Write-Host "Backed up: $fileName -> $(Split-Path $backupPath -Leaf)"
    $changed = $true
  } else {
    Write-Host "Not found: $fileName"
  }
}

Write-Host ""
if ($changed) {
  Write-Host "Done. Reopen Antigravity; it will rebuild these cache files automatically."
} else {
  Write-Host "No cache files needed changing."
}
