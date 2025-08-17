@echo off
echo Avvio applicazione G2 Ingegneria per Windows...
echo.

REM Controlla se Node.js è installato
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRORE: Node.js non trovato. Installa Node.js dal sito ufficiale.
    pause
    exit /b 1
)

REM Controlla se npm è installato
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRORE: npm non trovato. Reinstalla Node.js.
    pause
    exit /b 1
)

REM Installa le dipendenze se non esistono
if not exist "node_modules" (
    echo Installazione dipendenze...
    npm install
    if %errorlevel% neq 0 (
        echo ERRORE: Installazione dipendenze fallita.
        pause
        exit /b 1
    )
)

REM Trova una porta libera (3000, 3001, 3002, etc.)
set PORT=3000
:checkport
netstat -an | find ":%PORT%" >nul
if %errorlevel% equ 0 (
    set /a PORT+=1
    if %PORT% lss 3010 goto checkport
    echo ERRORE: Nessuna porta disponibile tra 3000-3009
    pause
    exit /b 1
)

echo Utilizzo porta %PORT%
echo.
echo Avvio server su http://localhost:%PORT%
echo Premi Ctrl+C per fermare il server
echo.

REM Avvia l'applicazione
set NODE_ENV=development
tsx server/index.ts