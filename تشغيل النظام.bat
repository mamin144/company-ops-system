@echo off
chcp 65001 >nul
:: Start-System: starts the Company Operations System service + opens the app.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo طلب صلاحيات المدير...
  powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
net start CompanyOpsAPI >nul 2>&1
timeout /t 6 /nobreak >nul
start http://localhost:4001
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set LANIP=%%i
echo.
echo النظام شغال على: http://localhost:4001
echo للاجهزة الاخرى على نفس الشبكة: http://%LANIP%:4001
pause
