$ErrorActionPreference = "Stop"

$userDir = Join-Path $env:APPDATA "Antigravity\User"
$keybindingsPath = Join-Path $userDir "keybindings.json"

Write-Host "Antigravity keybinding repair"
Write-Host "Keybindings file: $keybindingsPath"
Write-Host ""

if (!(Test-Path -LiteralPath $userDir)) {
  New-Item -ItemType Directory -Path $userDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (Test-Path -LiteralPath $keybindingsPath) {
  Copy-Item -LiteralPath $keybindingsPath -Destination "$keybindingsPath.bak.$timestamp"
  Write-Host "Backed up existing keybindings."
}

$content = @'
[
  {
    "key": "alt+enter",
    "command": "-antigravity.agent.acceptAgentStep",
    "when": "!editorTextFocus"
  },
  {
    "key": "alt+shift+backspace",
    "command": "-antigravity.agent.rejectAgentStep",
    "when": "!editorTextFocus"
  }
]
'@

Set-Content -LiteralPath $keybindingsPath -Value $content -Encoding UTF8

Write-Host "Done. Restart Antigravity for the keybinding change to take effect."
