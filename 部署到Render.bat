@echo off
echo.
echo ========================================
echo   部署到 Render.com - 三步完成
echo ========================================
echo.
echo 第 1 步：创建 GitHub 仓库
echo ---------------------------------
echo 1. 打开 https://github.com/new
echo 2. 仓库名填写：grab-word-game
echo 3. 设置为 Public（公开）
echo 4. 不要勾选任何初始化选项
echo 5. 点击 Create repository
echo.
echo 第 2 步：推送代码
echo ---------------------------------
echo 复制下面的命令到 Git Bash 或 PowerShell：
echo.
echo   cd "%~dp0"
echo   git remote add origin https://github.com/你的用户名/grab-word-game.git
echo   git push -u origin main
echo.
echo 第 3 步：部署到 Render
echo ---------------------------------
echo 1. 打开 https://render.com
echo 2. 用 GitHub 登录
echo 3. 点击 New + ^> Web Service
echo 4. 选择 grab-word-game 仓库
echo 5. 配置：
echo    - Start Command: node server.js
echo    - Plan: Free
echo 6. 点击 Create Web Service
echo.
echo 等待 2-3 分钟部署完成！
echo.
echo ========================================
pause
