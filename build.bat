@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Building Next.js app...
echo Project: %~dp0
echo.

where pnpm >nul 2>&1
if %errorlevel% equ 0 (
    pnpm run build
) else (
    npx next build
)

if %errorlevel% neq 0 (
    echo.
    echo Build failed. See КАК_СОБРАТЬ.md for path/encoding solutions.
    pause
    exit /b 1
)

echo.
echo Build completed successfully.
pause
