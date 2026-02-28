param(
  [Parameter(Mandatory = $false)]
  [string]$PinataJwt
)

$projectPath = "C:\Users\Joy\Desktop\XRPL Hackathon\XPRL_Hackathon_2026\scaffold-xrp\apps\web-nuxt"

Set-Location $projectPath

if ($PinataJwt) {
  $env:PINATA_JWT = $PinataJwt
}

if (-not $env:PINATA_JWT) {
  Write-Host "PINATA_JWT is not set."
  Write-Host "Usage:"
  Write-Host "  .\run-web-nuxt.ps1 -PinataJwt 'your-jwt'"
  Write-Host "or set once in shell:"
  Write-Host "  `$env:PINATA_JWT='your-jwt'"
  exit 1
}

$segments = ($env:PINATA_JWT -split '\.').Count
if ($segments -ne 3) {
  Write-Host "PINATA_JWT looks invalid (expected 3 JWT segments, got $segments)."
  exit 1
}

npx pnpm@8.10.0 dev