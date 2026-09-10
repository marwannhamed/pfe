# Start PostgreSQL for local dev (Docker Compose, port 5433)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Test-DockerEngine {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  docker info 2>$null | Out-Null
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $prev
  return $ok
}

function Start-DockerDesktopIfNeeded {
  if (Test-DockerEngine) { return }
  $dockerExe = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $dockerExe)) {
    Write-Host "Docker Desktop is not installed or not at the default path." -ForegroundColor Red
    exit 1
  }
  Write-Host "Starting Docker Desktop (wait ~30-60s)..." -ForegroundColor Yellow
  Start-Process $dockerExe
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 3
    if (Test-DockerEngine) {
      Write-Host "Docker engine is running." -ForegroundColor Green
      return
    }
  }
  Write-Host "Docker did not become ready in time. Open Docker Desktop manually, then run: npm run db:up" -ForegroundColor Red
  exit 1
}

# Windows user env DATABASE_URL often points at local Postgres 5432 and breaks Prisma CLI
if ($env:DATABASE_URL -and $env:DATABASE_URL -notmatch ":5433/") {
  Write-Host "Note: clearing shell DATABASE_URL (was port 5432). backend/.env uses 5433." -ForegroundColor Yellow
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

Start-DockerDesktopIfNeeded

Write-Host "Starting postgres (localhost:5433)..." -ForegroundColor Cyan
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Waiting for database..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  $tcp = Test-NetConnection -ComputerName localhost -Port 5433 -WarningAction SilentlyContinue
  if ($tcp.TcpTestSucceeded) {
    $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/lease_management?schema=public"
    npx prisma migrate deploy *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  }
  Start-Sleep -Seconds 1
}

docker compose ps
Write-Host ""
if ($ready) {
  Write-Host "Database is ready on localhost:5433" -ForegroundColor Green
} else {
  Write-Host "Postgres container started but migrate deploy did not succeed yet. Retry: npx prisma migrate deploy" -ForegroundColor Yellow
}
Write-Host "Restart API if it was already running:  npm run start:dev" -ForegroundColor Green
Write-Host "Login: admin@leasemanager.com / Password123!" -ForegroundColor Green
Write-Host "Seed (optional): npm run db:seed" -ForegroundColor Green
