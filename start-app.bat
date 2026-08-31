@echo off
REM Starts both the backend (port 4000) and frontend (port 5173) dev servers.
REM Keep both windows open while you use the app.

start "Billing App - Backend" cmd /k "cd /d %~dp0server && npm run dev"
start "Billing App - Frontend" cmd /k "cd /d %~dp0client && npm run dev"
