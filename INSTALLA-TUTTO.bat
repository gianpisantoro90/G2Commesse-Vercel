@echo off
title Installazione G2 Ingegneria
color 0B
echo.
echo  ==========================================
echo   INSTALLAZIONE G2 INGEGNERIA
echo  ==========================================
echo.

REM Vai nella directory corretta
cd /d "%~dp0"

echo 🔍 Controllo se Node.js è installato...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Node.js NON TROVATO
    echo.
    echo 📥 DEVI INSTALLARE Node.js:
    echo    1. Vai su: https://nodejs.org
    echo    2. Scarica la versione LTS (consigliata)
    echo    3. Installa con tutte le opzioni predefinite
    echo    4. Riavvia il computer
    echo    5. Esegui di nuovo questo file
    echo.
    echo 🌐 Apro il sito per te...
    pause
    start https://nodejs.org
    exit
)

echo ✅ Node.js installato correttamente
echo 📋 Versione: 
node --version
echo.

echo 📦 Installazione dipendenze del progetto...
npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERRORE durante l'installazione
    echo 💡 Prova a:
    echo    1. Riavviare il computer
    echo    2. Eseguire come amministratore
    echo    3. Controllare la connessione internet
    echo.
    pause
    exit
)

echo.
echo ✅ INSTALLAZIONE COMPLETATA!
echo.
echo 🎯 PROSSIMI PASSI:
echo    1. Fai doppio click su "AVVIA-G2-INGEGNERIA.bat"
echo    2. L'applicazione si aprirà automaticamente nel browser
echo.
echo 📝 NOTA: Tieni sempre aperta la finestra nera del server
echo.
pause