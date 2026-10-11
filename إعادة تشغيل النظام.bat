@echo off
chcp 65001 >nul
:: Restart-System: restarts the service so new builds take effect.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo طلب صلاحيات المدير...
  powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
echo إيقاف النظام...
net stop CompanyOpsAPI
timeout /t 4 /nobreak >nul
echo تشغيل النظام...
net start CompanyOpsAPI
timeout /t 8 /nobreak >nul
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set LANIP=%%i
start http://localhost:4001
echo.
echo النظام شغال على: http://localhost:4001
echo للاجهزة الاخرى: http://%LANIP%:4001
pause
