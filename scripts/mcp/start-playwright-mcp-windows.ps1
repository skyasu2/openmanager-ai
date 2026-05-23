param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath,

  [int]$Port = 8931,

  [ValidateSet("msedge", "chrome", "chromium", "firefox", "webkit")]
  [string]$Browser = "msedge",

  # Known-good version for this repo's Windows HTTP transport path.
  [ValidateNotNullOrEmpty()]
  [string]$Version = "0.0.55"
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
Write-Host "[playwright-mcp] Version: @playwright/mcp@$Version"
Write-Host "[playwright-mcp] Starting server..."

npx -y "@playwright/mcp@$Version" `
  --port $Port `
  --host 0.0.0.0 `
  --browser $Browser `
  --output-dir "tmp/playwright/mcp/screenshots"
