# Installs the Company Operations System as a Windows Service (NSSM).
# MUST run as Administrator (right-click > Run as administrator,
# or let Start-System.bat elevate automatically).
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Run this script as Administrator: right-click PowerShell > Run as administrator, then run the script again.' }

$ProjectRoot = 'C:\Users\PC-01\Documents\Default Project\company-ops-system'
$ApiDir = Join-Path $ProjectRoot 'apps\api'
$NodeExe = 'C:\Program Files\nodejs\node.exe'
$Nssm = 'C:\tools\nssm\nssm-2.24\win64\nssm.exe'
$Svc = 'CompanyOpsAPI'

if (-not (Test-Path $NodeExe)) { throw "node.exe not found at $NodeExe" }
if (-not (Test-Path $Nssm)) { throw "nssm.exe not found at $Nssm" }
if (-not (Test-Path (Join-Path $ApiDir 'dist\server.js'))) { throw 'API not built. Run: npm run build --workspace @cos/api' }
if (-not (Test-Path (Join-Path $ProjectRoot 'apps\web\dist\index.html'))) { throw 'Web not built. Run: npm run build --workspace @cos/web' }

New-Item -ItemType Directory -Path (Join-Path $ApiDir 'logs') -Force | Out-Null

# Remove previous installation if present (keeps data: DB + storage untouched).
# stop/remove fail on fresh installs — swallow those errors explicitly.
try { & $Nssm stop $Svc 2>&1 | Out-Null } catch { }
try { & $Nssm remove $Svc confirm 2>&1 | Out-Null } catch { }
Start-Sleep -Seconds 2

& $Nssm install $Svc $NodeExe '--env-file=.env dist\server.js'
& $Nssm set $Svc AppDirectory $ApiDir
& $Nssm set $Svc DisplayName 'Company Operations System'
& $Nssm set $Svc Description 'Company Operations System API + Web UI (single port 4001)'
& $Nssm set $Svc Start SERVICE_AUTO_START
& $Nssm set $Svc DependOnService postgresql-x64-18
& $Nssm set $Svc AppEnvironmentExtra 'NODE_ENV=production' 'PORT=4001'
& $Nssm set $Svc AppStdout (Join-Path $ApiDir 'logs\service-out.log')
& $Nssm set $Svc AppStderr (Join-Path $ApiDir 'logs\service-err.log')
& $Nssm set $Svc AppRotateFiles 1
& $Nssm set $Svc AppRotateBytes 10485760

# LAN access for employee devices: single port 4001
New-NetFirewallRule -DisplayName 'CompanyOps Web+API (4001)' -Direction Inbound `
  -Protocol TCP -LocalPort 4001 -Action Allow -ErrorAction SilentlyContinue | Out-Null

# Daily DB backup at 02:00 (keeps newest 14 dumps)
$backupScript = Join-Path $ProjectRoot 'scripts\backup-db-local.ps1'
$bakAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$bakTrigger = New-ScheduledTaskTrigger -Daily -At 02:00
Register-ScheduledTask -TaskName 'CompanyOps-Backup' -Action $bakAction `
  -Trigger $bakTrigger -User 'SYSTEM' -RunLevel Highest -Force | Out-Null

& $Nssm start $Svc
Start-Sleep -Seconds 8
& $Nssm status $Svc
Write-Output 'Install complete. Verify: http://localhost:4001/api/health'
