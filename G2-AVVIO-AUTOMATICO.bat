@echo off
setlocal EnableDelayedExpansion
title G2 Ingegneria - Avvio Automatico
color 0A
chcp 65001 >nul 2>&1

cls
echo.
echo    ██████╗ ██████╗     ██╗███╗   ██╗ ██████╗ 
echo   ██╔════╝ ╚════██╗    ██║████╗  ██║██╔════╝ 
echo   ██║  ███╗ █████╔╝    ██║██╔██╗ ██║██║  ███╗
echo   ██║   ██║██╔═══╝     ██║██║╚██╗██║██║   ██║
echo   ╚██████╔╝███████╗    ██║██║ ╚████║╚██████╔╝
echo    ╚═════╝ ╚══════╝    ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
echo.
echo         Sistema Gestione Commesse - AVVIO AUTOMATICO
echo              Versione Locale con Persistenza Dati
echo.
echo ================================================================
echo.

:: Verifica Node.js
echo [1/6] Controllo Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ❌ ERRORE: Node.js non installato!
    echo.
    echo 📥 SOLUZIONE AUTOMATICA:
    echo    1. Scarica Node.js LTS da: https://nodejs.org/
    echo    2. Installa seguendo la procedura guidata
    echo    3. Riavvia il computer
    echo    4. Rilancia questo file BAT
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js trovato
node --version

:: Vai nella directory corretta
echo.
echo [2/6] Verifica directory progetto...
cd /d "%~dp0"
if not exist "server\index.ts" (
    echo ❌ ERRORE: File server\index.ts non trovato nella directory: %cd%
    echo 📁 Assicurati che questo file BAT sia nella cartella principale del progetto G2
    pause
    exit /b 1
)
echo ✅ Directory progetto verificata: %cd%

:: Crea directory data
echo.
echo [3/6] Creazione directory dati...
if not exist "data" (
    mkdir "data"
    echo ✅ Directory 'data' creata per la persistenza
) else (
    echo ✅ Directory 'data' già esistente
)

:: Controlla e installa dipendenze
echo.
echo [4/6] Controllo dipendenze...
if not exist "node_modules" (
    echo 📦 Installazione dipendenze in corso...
    echo ⏰ Questo processo può richiedere alcuni minuti...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ ERRORE: Installazione dipendenze fallita!
        echo.
        echo 🔧 POSSIBILI SOLUZIONI:
        echo    1. Controlla la connessione internet
        echo    2. Esegui come Amministratore questo file BAT
        echo    3. Elimina la cartella node_modules e riprova
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dipendenze installate con successo
) else (
    echo ✅ Dipendenze già installate
)

:: Verifica porta 5000
echo.
echo [5/6] Controllo disponibilità porta 5000...
netstat -ano | findstr :5000 | findstr LISTENING >nul
if not errorlevel 1 (
    echo ⚠️  Porta 5000 già occupata - tentativo di liberarla...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
echo ✅ Porta 5000 disponibile

:: Avvia applicazione
echo.
echo [6/6] Avvio G2 Ingegneria in modalità locale...
echo.
echo ================================================================
echo.
echo    🚀 APPLICAZIONE IN AVVIO...
echo    📂 Dati salvati in: %cd%\data
echo    🌐 Indirizzo: http://localhost:5000  
echo    ⛔ Per fermare: Premi Ctrl+C in questa finestra
echo.
echo    ⚠️  NON CHIUDERE QUESTA FINESTRA - L'APP SI FERMEREBBE!
echo.
echo ================================================================
echo.

:: Imposta modalità locale
set NODE_ENV=local
set FORCE_COLOR=1

:: Avvia server con gestione errori
npx tsx server/index.ts
if errorlevel 1 (
    echo.
    echo ================================================================
    echo    ❌ APPLICAZIONE FERMATA CON ERRORE
    echo ================================================================
    echo.
    echo 🔍 POSSIBILI CAUSE:
    echo    • Conflitto di porta ^(un'altra app usa la 5000^)
    echo    • Antivirus che blocca l'applicazione
    echo    • Permessi insufficienti per scrivere in 'data/'
    echo    • Dipendenze corrotte o incomplete
    echo.
    echo 🛠️  SOLUZIONI RAPIDE:
    echo    1. Riavvia il computer e rilancia questo BAT
    echo    2. Esegui come Amministratore ^(click destro^)  
    echo    3. Controlla che Windows Defender non blocchi l'app
    echo    4. Elimina cartella node_modules e rilancia
    echo.
    echo 📞 Se il problema persiste, contatta il supporto tecnico
    echo.
) else (
    echo.
    echo ================================================================
    echo    ✅ APPLICAZIONE FERMATA CORRETTAMENTE
    echo ================================================================
    echo.
    echo 💾 I dati sono stati salvati in: %cd%\data
    echo 🔄 Per riavviare: rilancia questo file BAT
    echo.
)

echo Premi un tasto per chiudere questa finestra...
pause >nul