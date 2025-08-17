@echo off
title G2 Ingegneria - Installazione e Avvio Completo
color 02
cls

echo.
echo ================================================================
echo                G2 INGEGNERIA - SETUP COMPLETO
echo ================================================================
echo.
echo Questo script installa TUTTO automaticamente:
echo • Node.js ^(se mancante^)
echo • Dipendenze del progetto  
echo • Configurazione ambiente locale
echo • Avvio automatico dell'applicazione
echo.
echo ================================================================
echo.

:: Richiedi conferma
set /p "conferma=Vuoi procedere con l'installazione completa? (s/n): "
if /i not "%conferma%"=="s" (
    echo Installazione annullata.
    pause
    exit /b 0
)

echo.
echo [FASE 1] Controllo Node.js...

:: Controlla se Node.js è installato
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js NON trovato - installazione automatica...
    
    :: Scarica Node.js
    echo Scaricamento Node.js LTS...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi' -OutFile '%temp%\nodejs.msi'}"
    
    if exist "%temp%\nodejs.msi" (
        echo Installazione Node.js in corso...
        start /wait msiexec /i "%temp%\nodejs.msi" /quiet /norestart
        del "%temp%\nodejs.msi"
        
        :: Ricarica le variabili d'ambiente
        call refreshenv >nul 2>&1
        
        :: Verifica installazione
        where node >nul 2>nul
        if errorlevel 1 (
            echo ❌ Installazione Node.js fallita!
            echo Installa manualmente da: https://nodejs.org/
            pause
            exit /b 1
        )
        echo ✅ Node.js installato correttamente!
    ) else (
        echo ❌ Download Node.js fallito!
        echo Installa manualmente da: https://nodejs.org/
        pause
        exit /b 1
    )
) else (
    echo ✅ Node.js già installato
    node --version
)

echo.
echo [FASE 2] Preparazione ambiente...

:: Vai nella directory del progetto
cd /d "%~dp0"

:: Crea directory data
if not exist "data" mkdir "data"
echo ✅ Directory dati creata

:: Pulisci installazioni precedenti se corrotte
if exist "node_modules" if exist "package-lock.json" (
    set /p "pulisci=Reinstallare le dipendenze da zero? (raccomandato se ci sono stati errori) (s/n): "
    if /i "!pulisci!"=="s" (
        echo Pulizia dipendenze precedenti...
        rmdir /s /q "node_modules" 2>nul
        del "package-lock.json" 2>nul
    )
)

echo.
echo [FASE 3] Installazione dipendenze del progetto...
echo Questo può richiedere diversi minuti...

call npm install
if errorlevel 1 (
    echo.
    echo ❌ ERRORE nell'installazione delle dipendenze!
    echo.
    echo Soluzioni:
    echo 1. Verifica connessione internet
    echo 2. Esegui come Amministratore
    echo 3. Disabilita temporaneamente antivirus
    echo.
    pause
    exit /b 1
)

echo ✅ Dipendenze installate!

echo.
echo [FASE 4] Configurazione finale...

:: Crea file di configurazione locale se non esiste
if not exist ".env.local" (
    echo NODE_ENV=local > .env.local
    echo ✅ File configurazione locale creato
)

echo.
echo ================================================================
echo                    INSTALLAZIONE COMPLETATA!
echo ================================================================
echo.
echo 🎉 G2 Ingegneria è pronto per l'uso!
echo.
echo 📂 Dati salvati in: %cd%\data
echo 🌐 URL applicazione: http://localhost:5000
echo.
echo Vuoi avviare subito l'applicazione?
set /p "avvia=Avviare ora G2 Ingegneria? (s/n): "
if /i "%avvia%"=="s" (
    echo.
    echo Avvio in corso...
    call "G2-AVVIO-AUTOMATICO.bat"
) else (
    echo.
    echo Per avviare in futuro, usa: G2-AVVIO-AUTOMATICO.bat
    echo.
    pause
)