@echo off
echo.
echo ============================================
echo   关闭现有 Chrome 并启动调试模式
echo ============================================
echo.

REM 关闭所有 Chrome 进程
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 正在启动 Chrome (调试模式)...
echo.

REM 启动 Chrome 带远程调试
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug-grab" "https://cloud.mongodb.com/v2"

timeout /t 3 /nobreak >nul

echo.
echo ✓ Chrome 已启动！
echo ✓ 调试端口：9222
echo ✓ 已打开 MongoDB Atlas
echo.
echo 现在告诉 AI："Chrome 已准备好"
echo.
pause
