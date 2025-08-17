@echo off
echo.
echo ================================================
echo   G2 INGEGNERIA - AVVIO VERSIONE LOCALE
echo ================================================
echo.

:: Verifica se Node.js è installato
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: Node.js non è installato!
    echo    Scarica e installa Node.js da: https://nodejs.org/
    pause
    exit /b 1
)

:: Verifica se npm è installato
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: npm non è disponibile!
    pause
    exit /b 1
)

echo ✅ Node.js trovato
echo.

:: Verifica se le dipendenze sono installate
if not exist "node_modules" (
    echo 📦 Installazione dipendenze...
    call npm install
    if errorlevel 1 (
        echo ❌ ERRORE: Installazione dipendenze fallita!
        pause
        exit /b 1
    )
)

echo ✅ Dipendenze verificate
echo.

:: Crea directory data se non esiste
if not exist "data" (
    mkdir data
    echo 📁 Directory 'data' creata per la persistenza locale
)

echo ✅ Configurazione locale verificata
echo.

:: Avvia l'applicazione in modalità locale
echo 🚀 Avvio G2 Ingegneria in modalità locale...
echo    I dati saranno salvati nella cartella 'data'
echo    Premi Ctrl+C per fermare l'applicazione
echo.

:: Imposta variabile ambiente per modalità locale
set NODE_ENV=local

:: Avvia direttamente con tsx per modalità locale
call npx tsx server/index.ts

:: Se arriviamo qui, l'applicazione è stata fermata
echo.
echo ⏹️  Applicazione fermata
echo    I dati sono stati salvati nella cartella 'data'
echo.
pause