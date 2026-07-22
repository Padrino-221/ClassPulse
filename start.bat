@echo off
title Attendy - Starting Servers

echo Stopping any existing servers...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

start "Attendy API" cmd /k "cd /d "%~dp0backend" && node src/index.js"
start "Attendy Frontend" cmd /k "cd /d "%~dp0frontend" && node .\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 3000"

echo Both servers starting...
echo Backend:  http://localhost:5000
echo Backend LAN: http://<your-pc-ip>:5000
echo Frontend LAN: https://<your-pc-ip>:3000
