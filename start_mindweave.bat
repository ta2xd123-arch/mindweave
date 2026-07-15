@echo off
echo Starting MINDWEAVE Server...
cd /d "%~dp0"
start cmd /k "npm start"

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening MINDWEAVE in your browser...
start http://localhost:3000
