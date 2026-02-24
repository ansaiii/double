@echo off
echo Setting up Qt project...

REM Check if Qt is installed
where qmake >nul 2>nul
if %errorlevel% neq 0 (
    echo Qt is not installed. Please install Qt from https://www.qt.io/download
    echo You can use the Qt Online Installer or download from your package manager.
    exit /b 1
)

REM Create project directory structure
mkdir src
mkdir include
mkdir resources

REM Create basic CMakeLists.txt
echo cmake_minimum_required(VERSION 3.16)
echo project(Double VERSION 1.0.0 LANGUAGES CXX)
echo.
echo set(CMAKE_CXX_STANDARD 17)
echo set(CMAKE_CXX_STANDARD_REQUIRED ON)
echo.
echo find_package(Qt6 REQUIRED COMPONENTS Core Widgets)
echo.
echo set(SOURCES
echo     src/main.cpp
echo     src/mainwindow.cpp
echo )
echo.
echo set(HEADERS
echo     include/mainwindow.h
echo )
echo.
echo add_executable(double \${SOURCES} \${HEADERS})
echo.
echo target_link_libraries(double PRIVATE Qt6::Core Qt6::Widgets)
echo.
echo install(TARGETS double RUNTIME DESTINATION bin) > CMakeLists.txt

REM Create main.cpp
echo #include "mainwindow.h"
echo #include <QApplication>
echo.
echo int main(int argc, char *argv[])
echo {
echo     QApplication app(argc, argv);
echo     MainWindow window;
echo     window.show();
echo     return app.exec();
echo } > src\main.cpp

REM Create mainwindow.h
echo #ifndef MAINWINDOW_H
echo #define MAINWINDOW_H
echo.
echo #include <QMainWindow>
echo.
echo class MainWindow : public QMainWindow
echo {
echo     Q_OBJECT
echo.
echo public:
echo     MainWindow(QWidget *parent = nullptr);
echo     ~MainWindow();
echo };
echo.
echo #endif // MAINWINDOW_H > include\mainwindow.h

REM Create mainwindow.cpp
echo #include "mainwindow.h"
echo #include <QLabel>
echo.
echo MainWindow::MainWindow(QWidget *parent)
echo     : QMainWindow(parent)
echo {
echo     setWindowTitle("Double App");
echo     setFixedSize(400, 300);
echo.
echo     QLabel *label = new QLabel("Hello from Double!", this);
echo     label->setAlignment(Qt::AlignCenter);
echo     setCentralWidget(label);
echo }
echo.
echo MainWindow::~MainWindow()
echo {
echo } > src\mainwindow.cpp

REM Create build script
echo @echo off
echo echo Building Qt project...
echo.
echo REM Create build directory
echo if not exist build mkdir build
echo cd build
echo.
echo REM Configure with CMake
echo cmake .. -G "Visual Studio 17 2022" -A x64
echo.
echo REM Build
echo cmake --build . --config Release
echo.
echo echo Build complete!
echo echo Executable is in: build\Release\double.exe > build.bat

echo.
echo Qt project setup complete!
echo.
echo Next steps:
echo 1. Install Qt development tools if not already installed
echo 2. Run build.bat to compile the project
echo 3. For macOS/Linux builds, use appropriate CMake generators
echo.
echo Note: Qt requires separate builds for each platform.