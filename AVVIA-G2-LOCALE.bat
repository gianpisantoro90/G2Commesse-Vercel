@echo off
title G2 Ingegneria - Avvio Rapido
color 0F
cls

echo.
echo    ██████╗ ██████╗     ██╗███╗   ██╗ ██████╗ 
echo   ██╔════╝ ╚════██╗    ██║████╗  ██║██╔════╝ 
echo   ██║  ███╗ █████╔╝    ██║██╔██╗ ██║██║  ███╗
echo   ██║   ██║██╔═══╝     ██║██║╚██╗██║██║   ██║
echo   ╚██████╔╝███████╗    ██║██║ ╚████║╚██████╔╝
echo    ╚═════╝ ╚══════╝    ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
echo.
echo              Sistema Gestione Commesse
echo              Versione Locale con Persistenza
echo.
echo    ============================================
echo.

REM Check Node
where node >nul 2>nul || (
    echo    ERRORE: Node.js non installato!
    echo    Vai su: https://nodejs.org
    pause & exit /b
)

REM Create data folder
if not exist data mkdir data

REM Quick start message
echo    ✅ Avvio rapido in modalità locale...
echo    📂 Dati salvati in: %cd%\data  
echo    🌐 App disponibile su: http://localhost:5000
echo    ⛔ Per fermare: Ctrl+C
echo.
echo    ============================================
echo.

REM Set local mode and start
set NODE_ENV=local
npx tsx server/index.ts || (
    echo.
    echo    ❌ Errore avvio! Possibili cause:
    echo    • Porta 5000 occupata
    echo    • Dipendenze mancanti ^(esegui: npm install^)
    echo    • Permessi insufficienti
    echo.
    pause
)

echo.
echo    📴 Applicazione fermata
echo    💾 Dati conservati in: data/
echo.
pause