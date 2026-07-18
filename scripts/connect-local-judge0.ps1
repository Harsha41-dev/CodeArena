param(
  [Parameter(Mandatory = $true)]
  [string]$Judge0BaseUrl,

  [switch]$StartDev
)

$ErrorActionPreference = "Stop"

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $line = "$Key=$Value"
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType File -Path $Path | Out-Null
  }

  $content = Get-Content -LiteralPath $Path
  $pattern = "^\s*$([regex]::Escape($Key))="
  $updated = $false
  $next = foreach ($item in $content) {
    if ($item -match $pattern) {
      $updated = $true
      $line
    } else {
      $item
    }
  }

  if (-not $updated) {
    $next += $line
  }

  Set-Content -LiteralPath $Path -Value $next -Encoding ASCII
}

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"
$apiEnvPath = Join-Path $root "apps/api/.env"
$examplePath = Join-Path $root ".env.example"

if (-not (Test-Path -LiteralPath $envPath)) {
  if (-not (Test-Path -LiteralPath $examplePath)) {
    throw "Missing .env and .env.example"
  }
  Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$baseUrl = $Judge0BaseUrl.TrimEnd("/")
Write-Host "Checking Judge0 at $baseUrl"

$languages = Invoke-RestMethod -Method Get -Uri "$baseUrl/languages" -TimeoutSec 10
if (-not $languages -or $languages.Count -lt 1) {
  throw "Judge0 /languages returned no languages"
}
Write-Host "Judge0 languages: $($languages.Count)"

$sourceCode = "#include <stdio.h>`nint main(void){printf(`"ok\n`");return 0;}`n"
$payload = @{
  language_id = 50
  source_code = $sourceCode
  stdin = ""
} | ConvertTo-Json

$submission = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/submissions?base64_encoded=false&wait=true" `
  -ContentType "application/json" `
  -Body $payload `
  -TimeoutSec 30

if ($submission.status.id -ne 3 -or $submission.stdout -ne "ok`n") {
  $message = $submission.message
  if (-not $message) { $message = $submission.status.description }
  throw "Judge0 execution check failed: $message"
}
Write-Host "Judge0 execution check passed."

Set-EnvValue -Path $envPath -Key "EXECUTOR_MODE" -Value "judge0"
Set-EnvValue -Path $envPath -Key "JUDGE0_BASE_URL" -Value $baseUrl
Set-EnvValue -Path $envPath -Key "JUDGE0_API_KEY" -Value ""
Set-EnvValue -Path $envPath -Key "ALLOW_MOCK_EXECUTOR" -Value "false"
Set-EnvValue -Path $apiEnvPath -Key "EXECUTOR_MODE" -Value "judge0"
Set-EnvValue -Path $apiEnvPath -Key "JUDGE0_BASE_URL" -Value $baseUrl
Set-EnvValue -Path $apiEnvPath -Key "JUDGE0_API_KEY" -Value ""
Set-EnvValue -Path $apiEnvPath -Key "ALLOW_MOCK_EXECUTOR" -Value "false"

Write-Host "Updated $envPath and $apiEnvPath for Judge0."

Push-Location $root
try {
  docker compose up -d postgres redis
  npm run judge0:health
  npm run db:migrate
  npm run languages:sync:judge0
  npm run db:seed

  if ($StartDev) {
    npm run dev
  } else {
    Write-Host "Ready. Start CodeArena with: npm run dev"
  }
} finally {
  Pop-Location
}
