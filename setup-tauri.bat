@echo off
echo Setting up Tauri project...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Check if Rust is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo Rust is not installed. Please install Rust from https://rustup.rs/
    echo After installing Rust, restart this script.
    exit /b 1
)

REM Initialize a simple web project
npm init -y
npm install --save-dev @tauri-apps/cli

REM Create basic web structure
mkdir src
mkdir public

REM Create HTML file
echo <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Double App</title>
</head>
<body>
    <h1>Hello from Double!</h1>
    <p>This is a cross-platform Tauri app.</p>
</body>
</html> > src\index.html

REM Initialize Tauri project
npx tauri init

echo.
echo Tauri project setup complete!
echo.
echo Next steps:
echo 1. Review the generated tauri.conf.json file
echo 2. Install frontend framework if needed (React, Vue, Svelte, etc.)
echo 3. Run: npm run tauri dev
echo 4. Build: npm run tauri build
echo.