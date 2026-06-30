$ErrorActionPreference = 'Stop'

$taskName = 'Meika Weekly GitHub Deploy'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$deployScript = Join-Path $repoRoot 'scripts\weekly-github-deploy.ps1'

if (-not (Test-Path -LiteralPath $deployScript)) {
  throw "Deploy script not found: $deployScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$deployScript`"" `
  -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 6:00PM
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Build and push the Mei Ka project to the GitHub repository every Friday at 18:00 local time.' `
  -Force | Out-Null

Write-Host "Registered scheduled task: $taskName"
