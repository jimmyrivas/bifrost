# Bifrost Windows Installer Builder (native PowerShell)
# Run from project root: powershell -File scripts/build-windows.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot)

$version = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "=== Bifrost Windows Installer Builder ===" -ForegroundColor Cyan
Write-Host "Version: $version"
Write-Host ""

# 1. Dependencies
if (-not (Test-Path node_modules)) {
    Write-Host "[1/4] Installing dependencies..."
    npm ci
} else {
    Write-Host "[1/4] Dependencies OK"
}

# 2. Rebuild native modules
Write-Host "[2/4] Rebuilding native modules..."
npx electron-rebuild -f -w better-sqlite3 node-pty

# 3. Build
Write-Host "[3/4] Building with electron-vite..."
npx electron-vite build

# 4. Package
Write-Host "[4/4] Packaging for Windows..."
npx electron-builder --win --x64

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
$exe = Get-ChildItem dist -Filter "*.exe" -Recurse | Select-Object -First 1
if ($exe) {
    $size = [math]::Round($exe.Length / 1MB, 1)
    Write-Host "  Installer: $($exe.FullName) (${size}MB)"
}
Write-Host "  Version:   $version"
