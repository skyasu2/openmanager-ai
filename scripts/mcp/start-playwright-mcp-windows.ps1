param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath,

  [int]$Port = 8931,

  [ValidateSet("msedge", "chrome", "chromium", "firefox", "webkit")]
  [string]$Browser = "msedge"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $RepoPath)) {
  Write-Error "Repo path not found: $RepoPath"
  exit 1
}

Set-Location -Path $RepoPath

Write-Host "[playwright-mcp] RepoPath: $RepoPath"
Write-Host "[playwright-mcp] Port: $Port"
Write-Host "[playwright-mcp] Browser: $Browser"
Write-Host "[playwright-mcp] Starting server..."

npx -y @playwright/mcp@latest `
  --port $Port `
  --host 0.0.0.0 `
  --browser $Browser `
  --output-dir ".playwright-mcp/screenshots"
