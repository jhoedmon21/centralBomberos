@echo off
title FuegoMap - Central de Mando
cd /d "%~dp0"
echo Iniciando la central de mando FuegoMap...
echo (Manten esta ventana abierta mientras usas la aplicacion)
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
npm run dev
