$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$env:SEED_MINIMAL = '1'
Write-Host 'Resetting database (super admin only)...' -ForegroundColor Cyan
npx prisma db push --force-reset --accept-data-loss
npx prisma db seed
Write-Host 'Done — admin@leasemanager.com / Password123!' -ForegroundColor Green
