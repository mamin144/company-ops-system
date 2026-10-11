@echo off
chcp 65001 >nul
:: Stop-System: stops the Company Operations System service.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo طلب صلاحيات المدير...
  powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
net stop CompanyOpsAPI
echo.
echo تم إيقاف النظام.
pause
