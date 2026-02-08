@echo off
chcp 65001 >nul
cd /d "%~dp0"
pnpm dev
if errorlevel 1 pause
