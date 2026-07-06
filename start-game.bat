@echo off
cd /d "%~dp0"
echo Starting Emberfall at http://localhost:8123 (Ctrl+C here to stop)...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8123"
node server.js
