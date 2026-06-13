# CompanyVerse — Start Script
# Run from the repo root:  pwsh start.ps1
# Installs all dependencies if missing, then starts backend + frontend in parallel.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Write-Step([string]$msg) {
    Write-Host "`n  $msg" -ForegroundColor Cyan
}
function Write-Ok([string]$msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}
function Write-Warn([string]$msg) {
    Write-Host "  ! $msg" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║       CompanyVerse  Launcher      ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════╝" -ForegroundColor Magenta

# ── Prerequisites check ──────────────────────────────────────────────────────

Write-Step "Checking prerequisites..."

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python is not on PATH. Install Python 3.10+ and retry."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not on PATH. Install Node 18.18+ and retry."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not on PATH. Install Node 18.18+ and retry."
}

Write-Ok "Python $(python --version 2>&1)"
Write-Ok "Node   $(node --version)"
Write-Ok "npm    $(npm --version)"

# ── Backend setup ─────────────────────────────────────────────────────────────

$backendDir = Join-Path $root "backend"
$venvDir    = Join-Path $backendDir ".venv"
$pip        = Join-Path $venvDir "Scripts\pip.exe"
$python     = Join-Path $venvDir "Scripts\python.exe"
$envFile    = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"

Write-Step "Backend setup..."

if (-not (Test-Path $venvDir)) {
    Write-Warn ".venv not found — creating virtual environment..."
    & python -m venv $venvDir
    Write-Ok "Virtual environment created"
}

# Check if requirements are already satisfied by testing a key package.
$uvicornOk = & $python -c "import uvicorn" 2>$null; $LASTEXITCODE -eq 0
if (-not $uvicornOk) {
    Write-Warn "Installing Python dependencies (this may take a minute)..."
    & $pip install -r (Join-Path $backendDir "requirements.txt") --quiet
    Write-Ok "Python dependencies installed"
} else {
    Write-Ok "Python dependencies already installed"
}

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Warn ".env not found — copied from .env.example. Edit backend/.env if you need real credentials."
    }
} else {
    Write-Ok "backend/.env present"
}

# ── Frontend setup ────────────────────────────────────────────────────────────

$frontendDir  = Join-Path $root "frontend"
$nodeModules  = Join-Path $frontendDir "node_modules"
$envLocalFe   = Join-Path $frontendDir ".env.local"
$envExampleFe = Join-Path $frontendDir ".env.example"

Write-Step "Frontend setup..."

if (-not (Test-Path $nodeModules)) {
    Write-Warn "node_modules not found — running npm install..."
    Push-Location $frontendDir
    npm install --prefer-offline --no-audit --no-fund 2>&1 | Out-Null
    Pop-Location
    Write-Ok "npm packages installed"
} else {
    Write-Ok "node_modules already present"
}

if (-not (Test-Path $envLocalFe)) {
    if (Test-Path $envExampleFe) {
        Copy-Item $envExampleFe $envLocalFe
        Write-Ok "Copied frontend/.env.example → .env.local"
    }
} else {
    Write-Ok "frontend/.env.local present"
}

# ── Launch both servers ───────────────────────────────────────────────────────

Write-Step "Starting servers..."
Write-Host ""

# Backend in a new window so logs are visible separately.
$backendCmd = "Set-Location '$backendDir'; & '$python' run.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd `
    -WindowStyle Normal

# Brief pause so the backend gets a head start.
Start-Sleep -Seconds 2

# Frontend in this window (keeps it in the foreground).
Write-Host "  Backend  →  http://127.0.0.1:8000  (new window)" -ForegroundColor Green
Write-Host "  Frontend →  http://localhost:3000   (this window)" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C here to stop the frontend dev server." -ForegroundColor DarkGray
Write-Host ""

Push-Location $frontendDir
npm run dev
