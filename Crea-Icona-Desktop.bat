@echo off
title Creazione Icona Desktop
echo.
echo 🖥️ Creazione icona sul Desktop...

REM Percorso corrente
set "APP_PATH=%~dp0"
set "DESKTOP=%USERPROFILE%\Desktop"

REM Crea il collegamento
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%temp%\shortcut.vbs"
echo sLinkFile = "%DESKTOP%\G2 Ingegneria.lnk" >> "%temp%\shortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%temp%\shortcut.vbs"
echo oLink.TargetPath = "%APP_PATH%AVVIA-G2-INGEGNERIA.bat" >> "%temp%\shortcut.vbs"
echo oLink.WorkingDirectory = "%APP_PATH%" >> "%temp%\shortcut.vbs"
echo oLink.Description = "G2 Ingegneria - Sistema Gestione Commesse" >> "%temp%\shortcut.vbs"
echo oLink.Save >> "%temp%\shortcut.vbs"

cscript //nologo "%temp%\shortcut.vbs"
del "%temp%\shortcut.vbs"

echo ✅ Icona creata sul Desktop!
echo 📍 Nome: "G2 Ingegneria"
echo.
echo 💡 Ora puoi avviare l'app facendo doppio click sull'icona del Desktop
echo.
pause