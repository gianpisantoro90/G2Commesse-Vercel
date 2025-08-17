@echo off
chcp 65001 >nul 2>&1
title G2 Ingegneria - Versione Locale
cls
echo.
echo ================================================
echo   G2 INGEGNERIA - VERSIONE LOCALE
echo ================================================
echo.

:: Verifica Node.js
echo Controllo Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERRORE: Node.js non è installato!
    echo.
    echo Scarica Node.js da: https://nodejs.org/
    echo Installa la versione LTS e riavvia questo script
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js trovato
echo.

:: Verifica npm e tsx
echo Controllo dipendenze...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: npm non trovato!
    pause
    exit /b 1
)

:: Installa tsx se non presente
npx tsx --version >nul 2>&1
if errorlevel 1 (
    echo Installazione tsx...
    npm install -g tsx
)

echo ✅ Dipendenze verificate
echo.

:: Crea directory data
if not exist "data" (
    mkdir data
    echo ✅ Directory 'data' creata
) else (
    echo ✅ Directory 'data' esistente
)

:: Verifica se ci sono node_modules
if not exist "node_modules" (
    echo.
    echo 📦 Installazione dipendenze del progetto...
    echo Attendere, potrebbe richiedere alcuni minuti...
    npm install
    if errorlevel 1 (
        echo.
        echo ❌ ERRORE: Installazione dipendenze fallita!
        pause
        exit /b 1
    )
    echo ✅ Dipendenze installate
)

echo.
echo ================================================
echo   AVVIO APPLICAZIONE
echo ================================================
echo.
echo 🚀 Avvio G2 Ingegneria in modalità locale...
echo 📁 I dati saranno salvati in: %cd%\data
echo 🌐 L'app sarà disponibile su: http://localhost:5000
echo.
echo ⚠️  Per fermare l'app: Premi Ctrl+C
echo.

:: Imposta modalità locale e avvia
set NODE_ENV=local
cd /d "%~dp0"

:: Avvia con gestione errori
npx tsx server/index.ts

if errorlevel 1 (
    echo.
    echo ❌ ERRORE: L'applicazione si è fermata inaspettatamente
    echo.
    echo Possibili cause:
    echo - Porta 5000 già occupata da un'altra applicazione
    echo - Permessi insufficienti per scrivere nella cartella 'data'
    echo - Dipendenze mancanti o corrotte
    echo.
    echo Soluzioni:
    echo 1. Riavvia il computer e riprova
    echo 2. Esegui questo script come Amministratore
    echo 3. Controlla che nessun antivirus blocchi l'app
    echo.
)

echo.
echo ⏹️  Applicazione fermata
echo 💾 I dati sono stati salvati in: %cd%\data
echo.
pause