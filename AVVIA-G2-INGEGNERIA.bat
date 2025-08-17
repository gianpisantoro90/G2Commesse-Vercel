@echo off
title G2 Ingegneria - Sistema Gestione Commesse
color 0A
echo.
echo  ========================================
echo   G2 INGEGNERIA - GESTIONE COMMESSE
echo  ========================================
echo.

REM Vai nella directory corretta
cd /d "%~dp0"

REM Verifica Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js NON INSTALLATO
    echo.
    echo 📥 SCARICA Node.js da: https://nodejs.org
    echo    👉 Scegli "LTS" e installa tutto
    echo.
    pause
    start https://nodejs.org
    exit
)

echo ✅ Node.js trovato
node --version

REM Installa dipendenze automaticamente
if not exist "node_modules" (
    echo.
    echo 📦 Installazione dipendenze in corso...
    npm install --silent
    if %errorlevel% neq 0 (
        echo ❌ Errore installazione
        pause
        exit
    )
    echo ✅ Dipendenze installate
)

REM Trova porta libera partendo da 3000
set PORT=3000
:check_port
netstat -an 2>nul | find ":%PORT%" >nul
if %errorlevel% equ 0 (
    set /a PORT+=1
    if %PORT% lss 4000 goto check_port
    echo ❌ Nessuna porta disponibile
    pause
    exit
)

echo.
echo 🚀 AVVIO IN CORSO...
echo 📍 Porta: %PORT%
echo 🌐 URL: http://localhost:%PORT%
echo.
echo ⚠️  NON CHIUDERE QUESTA FINESTRA
echo 🛑 Per fermare: Ctrl+C oppure chiudi la finestra
echo.

REM Avvia automaticamente il browser dopo 3 secondi
start /min timeout /t 3 /nobreak >nul && start http://localhost:%PORT%

REM Avvia l'applicazione
set NODE_ENV=development
npx tsx server/index.ts

pause