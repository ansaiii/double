@echo off
echo Testing Electron app setup...
echo.

REM Check if node_modules exists
if exist node_modules (
    echo Dependencies installed.
    echo.
    echo To run the app: npm start
    echo.
    echo To build for Windows: npm run build:win
    echo To build for macOS: npm run build:mac  
    echo To build for Linux: npm run build:linux
    echo To build for all platforms: npm run build
) else (
    echo Installing dependencies...
    npm install
    echo.
    echo Dependencies installed successfully!
    echo.
    echo To run the app: npm start
)

echo.
echo Project structure:
echo - src/main.js (Electron main process)
echo - src/index.html (App UI)
echo - package.json (Project config)
echo - electron-builder.json (Build config)
echo.
pause