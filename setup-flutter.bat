@echo off
echo Setting up Flutter project...

REM Check if Flutter is installed
where flutter >nul 2>nul
if %errorlevel% neq 0 (
    echo Flutter is not installed. Please install Flutter from https://flutter.dev/
    echo You also need to install Dart SDK.
    exit /b 1
)

REM Create Flutter project
flutter create double_app

echo.
echo Flutter project setup complete!
echo.
echo Next steps:
echo 1. Navigate to the project: cd double_app
echo 2. Run on Windows: flutter run -d windows
echo 3. Build for macOS (requires macOS machine): flutter build macos
echo 4. Build for Linux: flutter build linux
echo.
echo Note: For macOS and Linux builds, you need to be on those platforms
echo or use CI/CD services.