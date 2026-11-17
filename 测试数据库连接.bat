@echo off
echo.
echo ==========================================
echo   测试 MongoDB 数据库连接
echo ==========================================
echo.

cd /d "%~dp0"

echo 设置环境变量...
set MONGO_URI=mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.tqoxq.mongodb.net/grab_word_game?retryWrites=true^&w=majority
set JWT_SECRET=grab-word-game-jwt-secret-2024-super-secure-key

echo.
echo 正在启动服务器...
echo.

node server.js

pause
