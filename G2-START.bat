@echo off
title G2 Ingegneria - Sistema Gestione Commesse
cls
color 0A

echo.
echo  ██████╗ ██████╗     ██╗███╗   ██╗ ██████╗ 
echo ██╔════╝ ╚════██╗    ██║████╗  ██║██╔════╝ 
echo ██║  ███╗ █████╔╝    ██║██╔██╗ ██║██║  ███╗
echo ██║   ██║██╔═══╝     ██║██║╚██╗██║██║   ██║
echo ╚██████╔╝███████╗    ██║██║ ╚████║╚██████╔╝
echo  ╚═════╝ ╚══════╝    ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
echo.
echo      SISTEMA GESTIONE COMMESSE - v1.0
echo      Modalita' Locale con Persistenza
echo ================================================
echo.

cd /d "%~dp0"

REM === CONTROLLO NODE.JS ===
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRORE] Node.js non installato
    echo.
    echo Scarica Node.js da: https://nodejs.org
    echo Installa la versione LTS e riavvia
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js: && node --version

REM === CREAZIONE DIRECTORY DATA ===
if not exist data (
    mkdir data
    echo [OK] Directory data creata
) else (
    echo [OK] Directory data trovata
)

REM === INSTALLAZIONE DIPENDENZE ===
if not exist node_modules (
    echo.
    echo [INFO] Prima installazione rilevata
    echo [INFO] Installazione dipendenze in corso...
    echo        Attendere 2-3 minuti...
    echo.
    npm install >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERRORE] Installazione fallita
        echo.
        echo Prova a:
        echo 1. Controllare connessione internet
        echo 2. Eseguire come Amministratore
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dipendenze installate
) else (
    echo [OK] Dipendenze gia' presenti
)

REM === DETERMINA PORTA DA UTILIZZARE ===
set APP_PORT=5000
if defined PORT set APP_PORT=%PORT%

REM === CHIUSURA PROCESSI SULLA PORTA ===
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%APP_PORT%') do (
    taskkill /F /PID %%p >nul 2>&1
)
echo [OK] Porta %APP_PORT% liberata

REM === AVVIO APPLICAZIONE ===
echo.
echo ================================================
echo.
echo [AVVIO] G2 Ingegneria in esecuzione...
echo.
echo [INFO] Dati salvati in: %cd%\data
echo [INFO] Porta utilizzata: %APP_PORT%
echo [INFO] URL: http://localhost:%APP_PORT%
echo [INFO] Apertura browser automatica...
echo [INFO] Per fermare: Ctrl+C
echo.
echo ================================================
echo.

REM Avvia browser dopo 3 secondi in background
start "" /b cmd /c "timeout /t 3 /nobreak >nul 2>&1 && start http://localhost:%APP_PORT%" >nul 2>&1

REM Imposta NODE_ENV=local, PORT e avvia
cmd /c "set NODE_ENV=local&& set PORT=%APP_PORT%&& npx tsx server/index.ts"

REM === APPLICAZIONE FERMATA ===
echo.
echo ================================================
echo [INFO] Applicazione fermata
echo [INFO] Dati salvati in: %cd%\data
echo ================================================
echo.
pause