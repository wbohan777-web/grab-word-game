@echo off
echo.
echo ==========================================
echo   抢词房 - 自动部署脚本
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] 正在推送代码到 GitHub...
git add -A
git commit -m "准备部署" 2>nul
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo 错误：推送失败！
    echo 请确保：
    echo 1. 已经登录 GitHub
    echo 2. 网络连接正常
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ 代码已推送到 GitHub
echo.
echo [2/3] 打开 Render 一键部署页面...
echo.

start https://render.com/deploy?repo=https://github.com/wbohan777-web/grab-word-game

echo.
echo ==========================================
echo   部署说明
echo ==========================================
echo.
echo 浏览器会自动打开 Render 部署页面
echo.
echo 👉 点击步骤：
echo    1. 点击 "Connect Account" 连接 GitHub
echo    2. 授权访问仓库
echo    3. 点击 "Apply" 开始部署
echo    4. 等待 2-3 分钟部署完成
echo.
echo 📝 环境变量（可选）：
echo    如果需要数据库功能，点击服务后添加：
echo    MONGO_URI = 你的MongoDB连接字符串
echo.
echo ==========================================
echo.
pause
