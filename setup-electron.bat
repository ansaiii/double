@echo off
echo Setting up Electron project...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Initialize package.json
npm init -y

REM Install Electron and development dependencies
npm install --save-dev electron electron-builder typescript @types/node

REM Create basic project structure
mkdir src
mkdir dist

REM Create main entry point
echo const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('src/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
}); > src\main.js

REM Create HTML file
echo <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Double App</title>
</head>
<body>
    <h1>Hello from Double!</h1>
    <p>This is a cross-platform Electron app.</p>
</body>
</html> > src\index.html

REM Update package.json with Electron configuration
powershell -Command "(Get-Content package.json) -replace '\"main\": \"index.js\"', '\"main\": \"src/main.js\"' | Set-Content package.json"
powershell -Command "(Get-Content package.json) -replace '\"scripts\": {', '\"scripts\": {\n    \"start\": \"electron .\",\n    \"build\": \"electron-builder\",' | Set-Content package.json"

REM Create build configuration
echo {
    "appId": "com.double.app",
    "productName": "Double",
    "directories": {
        "output": "dist"
    },
    "files": [
        "src/**/*",
        "package.json"
    ],
    "mac": {
        "category": "public.app-category.productivity"
    },
    "win": {
        "target": "nsis"
    },
    "linux": {
        "target": "AppImage"
    }
} > electron-builder.json

echo.
echo Electron project setup complete!
echo.
echo To run the app: npm start
echo To build for all platforms: npm run build
echo.