@echo off
echo TEST MODALITÀ LOCALE
echo.

:: Testa se il file storage funziona
set NODE_ENV=local

echo Creazione directory test...
if not exist "data" mkdir data

echo Impostazione NODE_ENV=local
echo %NODE_ENV%

echo Test avvio server per 10 secondi...
timeout /t 10 /nobreak | npx tsx server/index.ts

echo.
echo Test completato. Premi un tasto per chiudere.
pause