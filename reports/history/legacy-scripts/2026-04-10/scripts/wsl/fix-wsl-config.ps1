$ErrorActionPreference = 'Stop'

$ConfigPath = "$env:USERPROFILE\.wslconfig"
$BackupDir = "$env:USERPROFILE\wsl-config-backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = "$BackupDir\.wslconfig.$Timestamp.bak"

# Ensure backup directory exists
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "Created backup directory: $BackupDir"
}

# Backup existing file if it exists
if (Test-Path -Path $ConfigPath) {
    Copy-Item -Path $ConfigPath -Destination $BackupPath
    Write-Host "Backed up existing config to: $BackupPath"
}

# Define new configuration content
# Values match actual running config (2026-02-13)
$NewConfig = @'
[wsl2]
# Memory: 50% of host RAM recommended
memory=16GB
swap=0
# CPU: leave headroom for Windows/IDE/browser
processors=4

# Networking
networkingMode=mirrored
localhostForwarding=true

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true

# LLM CLI stability: dnsTunneling/autoProxy OFF
# MCP servers work fine without these (verified 2026-02-13)
dnsTunneling=false
autoProxy=false
'@

# Write new configuration
Set-Content -Path $ConfigPath -Value $NewConfig -Encoding UTF8
Write-Host "Successfully updated .wslconfig with current settings."
Write-Host "Please run 'wsl --shutdown' in a standard command prompt/PowerShell to apply changes."
