@echo off
REM =========================================
REM  G2 INGEGNERIA - VERSIONE LOCALE WINDOWS
REM  File testato e funzionante
REM =========================================

setlocal
cls
color 0A
title G2 Ingegneria - Modalita Locale

echo.
echo ================================================
echo   G2 INGEGNERIA - SISTEMA GESTIONE COMMESSE
echo   Versione Locale con Persistenza Dati
echo ================================================
echo.

REM Vai nella directory del progetto
cd /d "%~dp0"
echo Directory progetto: %cd%
echo.

REM Verifica Node.js
echo Controllo Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERRORE: Node.js non installato!
    echo.
    echo Scarica e installa Node.js da:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)
node --version
echo.

REM Verifica npm
echo Controllo npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERRORE: npm non trovato!
    echo.
    pause
    exit /b 1
)
npm --version
echo.

REM Crea directory data se non esiste
echo Preparazione directory dati...
if not exist "data" (
    mkdir "data"
    echo Directory 'data' creata
) else (
    echo Directory 'data' esistente
)
echo.

REM Verifica installazione dipendenze
echo Controllo dipendenze...
if not exist "node_modules" (
    echo.
    echo Installazione dipendenze in corso...
    echo Attendere prego ^(3-5 minuti^)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERRORE installazione dipendenze!
        pause
        exit /b 1
    )
    echo.
    echo Dipendenze installate con successo!
) else (
    echo Dipendenze gia' installate
)
echo.

REM Chiudi eventuali processi sulla porta 5000
echo Liberazione porta 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Porta 5000 disponibile
echo.

REM Avvia l'applicazione in modalità locale
echo ================================================
echo   AVVIO APPLICAZIONE IN MODALITA' LOCALE
echo ================================================
echo.
echo Dati salvati in: %cd%\data
echo Applicazione disponibile su: http://localhost:5000
echo.
echo Per fermare: premi Ctrl+C
echo.
echo ================================================
echo.

REM Imposta variabile ambiente e avvia
set NODE_ENV=local
set PORT=5000

REM Usa cross-env per Windows se disponibile
where cross-env >nul 2>&1
if %errorlevel% equ 0 (
    npx cross-env NODE_ENV=local tsx server/index.ts
) else (
    REM Fallback diretto
    npx tsx server/index.ts
)

REM Se arriviamo qui, l'app è stata fermata
echo.
echo ================================================
echo   APPLICAZIONE FERMATA
echo ================================================
echo.
echo Dati salvati in: %cd%\data
echo Per riavviare: rilancia questo file BAT
echo.
pause