@echo off
title Attendy - Stopping Servers

echo Stopping Attendy servers...
taskkill /f /im node.exe >nul 2>&1
echo All servers stopped.
pause
