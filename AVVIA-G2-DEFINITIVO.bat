@echo off
title G2 Ingegneria - Versione Locale Definitiva
cls

echo.
echo    G2 INGEGNERIA - SISTEMA GESTIONE COMMESSE
echo    ==========================================
echo.

cd /d "%~dp0"

REM Verifica Node
where node >nul 2>&1 || goto :errore_node

REM Crea data directory
if not exist data mkdir data

REM Installa dipendenze se necessario
if not exist node_modules (
    echo Installazione dipendenze...
    call npm install || goto :errore_npm
)

REM Avvio con NODE_ENV impostato correttamente
echo.
echo Avvio G2 Ingegneria...
echo Dati salvati in: %cd%\data
echo URL: http://localhost:5000
echo.

REM Metodo Windows per impostare variabile ambiente
set NODE_ENV=local&& npx tsx server/index.ts

goto :fine

:errore_node
echo ERRORE: Node.js non installato
echo Scarica da: https://nodejs.org
pause
exit /b 1

:errore_npm
echo ERRORE: Installazione dipendenze fallita
pause
exit /b 1

:fine
echo.
echo Applicazione fermata
pause