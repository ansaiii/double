@echo off
echo Starting Double Electron App...
echo.

REM Check if electron is installed
if not exist "node_modules\.bin\electron.cmd" (
    echo Installing Electron...
    call npm install electron@latest --save-dev
)

echo.
echo Running the app...
echo.
npm start

pause