# AGY Desktop — Windows Installer Script
param(
    [switch]$LaunchAfterInstall = $true
)

$ErrorActionPreference = "Stop"

$installDir = "$env:LOCALAPPDATA\Programs\AGY Desktop"
$sourceDir = "$PSScriptRoot\release\win-unpacked"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     INSTALADOR DE AGY DESKTOP PARA WINDOWS               " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host "Compilando aplicación y empaquetando recursos..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
pnpm build
Pop-Location

Write-Host "[1/4] Instalando archivos en: $installDir ..." -ForegroundColor Gray
if (Test-Path $installDir) {
    # If app is running, kill it first
    Get-Process "AGY Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 500
    Remove-Item -Path $installDir -Recurse -Force
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -Path "$sourceDir\*" -Destination $installDir -Recurse -Force

Write-Host "[2/4] Creando acceso directo en el Menú Inicio..." -ForegroundColor Gray
$wsh = New-Object -ComObject WScript.Shell
$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$startShortcut = $wsh.CreateShortcut("$startMenuDir\AGY Desktop.lnk")
$startShortcut.TargetPath = "$installDir\AGY Desktop.exe"
$startShortcut.WorkingDirectory = $installDir
$startShortcut.IconLocation = "$installDir\AGY Desktop.exe,0"
$startShortcut.Description = "Antigravity CLI Desktop Control Plane"
$startShortcut.Save()

Write-Host "[3/4] Creando acceso directo en el Escritorio..." -ForegroundColor Gray
$desktopDir = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = $wsh.CreateShortcut("$desktopDir\AGY Desktop.lnk")
$desktopShortcut.TargetPath = "$installDir\AGY Desktop.exe"
$desktopShortcut.WorkingDirectory = $installDir
$desktopShortcut.IconLocation = "$installDir\AGY Desktop.exe,0"
$desktopShortcut.Description = "Antigravity CLI Desktop Control Plane"
$desktopShortcut.Save()

Write-Host "[4/4] Creando desinstalador..." -ForegroundColor Gray
$uninstallScript = @"
@echo off
taskkill /F /IM "AGY Desktop.exe" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\AGY Desktop.lnk" 2>nul
del "%USERPROFILE%\Desktop\AGY Desktop.lnk" 2>nul
rd /s /q "$installDir" 2>nul
echo AGY Desktop ha sido desinstalado.
pause
"@
Set-Content -Path "$installDir\uninstall.cmd" -Value $uninstallScript

Write-Host ""
Write-Host "✔ ¡INSTALACIÓN COMPLETADA CON ÉXITO!" -ForegroundColor Green
Write-Host "  • Aplicación instalada en: $installDir" -ForegroundColor White
Write-Host "  • Acceso directo en el Escritorio: $desktopDir\AGY Desktop.lnk" -ForegroundColor White
Write-Host "  • Acceso directo en Menú Inicio: $startMenuDir\AGY Desktop.lnk" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($LaunchAfterInstall) {
    Write-Host "Iniciando AGY Desktop..." -ForegroundColor Cyan
    Start-Process "$installDir\AGY Desktop.exe"
}
