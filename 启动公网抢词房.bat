@echo off
chcp 65001 >nul
title 抢词房（公网版）— 这个窗口别关
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-public.ps1"
echo.
echo 已停止。
pause
