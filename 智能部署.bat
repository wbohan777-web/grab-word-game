@echo off
setlocal enabledelayedexpansion

echo.
echo ==========================================
echo   抢词房 - 智能部署脚本
echo ==========================================
echo.

cd /d "%~dp0"

:PUSH_RETRY
set /a retry_count=0
set max_retries=3

echo [1/2] 正在推送代码到 GitHub...
echo.

:PUSH_LOOP
set /a retry_count+=1
echo 尝试 %retry_count%/%max_retries%...

git push -u origin main 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ✓ 代码推送成功！
    goto DEPLOY
)

if %retry_count% lss %max_retries% (
    echo × 推送失败，3秒后重试...
    timeout /t 3 /nobreak >nul
    goto PUSH_LOOP
)

echo.
echo ==========================================
echo   推送失败 - 手动方案
echo ==========================================
echo.
echo 网络不稳定，请手动执行以下命令：
echo.
echo 1. 打开 PowerShell 或 Git Bash
echo 2. 运行：cd "%cd%"
echo 3. 运行：git push -u origin main
echo.
echo 推送成功后，访问这个链接一键部署：
echo https://render.com/deploy?repo=https://github.com/wbohan777-web/grab-word-game
echo.
echo 或者在 Render.com 手动连接仓库
echo.
pause
exit /b 1

:DEPLOY
echo.
echo [2/2] 打开 Render 部署页面...
echo.

start https://render.com/deploy?repo=https://github.com/wbohan777-web/grab-word-game

echo.
echo ==========================================
echo   后续步骤
echo ==========================================
echo.
echo 浏览器已打开 Render 部署页面
echo.
echo 👉 在网页中点击：
echo    1. Connect Account （连接 GitHub）
echo    2. Authorize （授权）
echo    3. Apply （应用配置）
echo    4. 等待 2-3 分钟部署完成
echo.
echo 📝 可选：配置数据库
echo    部署后在 Environment 添加：
echo    MONGO_URI = 你的MongoDB连接字符串
echo.
echo 🎮 部署完成后：
echo    Render 会给你一个网址
echo    立即可以玩游戏！
echo.
echo ==========================================
echo.
pause
