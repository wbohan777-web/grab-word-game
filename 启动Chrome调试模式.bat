@echo off
echo.
echo 正在启动 Chrome 浏览器（调试模式）...
echo.

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug" https://cloud.mongodb.com

echo.
echo Chrome 已启动！
echo 请告诉 AI 可以开始操作了。
echo.
pause
