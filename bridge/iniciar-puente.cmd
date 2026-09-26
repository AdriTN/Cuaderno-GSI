@echo off
title Cuaderno GSI - puente
where node >nul 2>nul || (echo Necesitas Node.js 18 o superior: https://nodejs.org & pause & exit /b 1)
node "%~dp0cuaderno-bridge.mjs" %*
pause
