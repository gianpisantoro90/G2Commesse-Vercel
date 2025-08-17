@echo off
setlocal EnableDelayedExpansion
title G2 Ingegneria - Locale
color 0A

echo.
echo  ========================================
echo   G2 INGEGNERIA - AVVIO LOCALE
echo  ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo  ERRORE: Node.js non installato!
    echo  Scarica da: https://nodejs.org/
    timeout /t 10 /nobreak >nul
    exit /b 1
)

REM Create data directory
if not exist "data" mkdir data

REM Set environment and start
echo  Impostazione modalità locale...
set NODE_ENV=local

echo  Avvio server...
echo  URL: http://localhost:5000
echo.
echo  Premi Ctrl+C per fermare
echo.

npx tsx server/index.ts

echo.
echo  Server fermato.
timeout /t 5 /nobreak >nul