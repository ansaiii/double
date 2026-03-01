@echo off
echo 正在设置明天7:30唤醒电脑...
echo.

:: 先禁用休眠，确保进入睡眠而不是休眠
powercfg /hibernate off 2>nul

:: 设置唤醒定时器（需要管理员权限）
echo 创建唤醒计划任务...
schtasks /create /tn "DoubleWakeUp" /tr "cmd /c exit" /sc once /st 07:30 /sd 2026/02/25 /f >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ 唤醒任务已创建
) else (
    echo ⚠ 唤醒任务创建失败（可能需要管理员权限）
    echo   请手动设置：任务计划程序 - 创建任务 - 触发器7:30 - 勾选"唤醒计算机"
)

echo.
echo 正在进入睡眠模式...
timeout /t 2 >nul

:: 进入睡眠
rundll32.exe powrprof.dll,SetSuspendState 0,1,0