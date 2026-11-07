@echo off
chcp 65001 >nul
title Lume AI - Assistente Pessoal
cd /d "%~dp0"

set "NODE_EXE=node"
set "NPM_EXE=npm"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    set "NPM_EXE=%ProgramFiles%\nodejs\npm.cmd"
  ) else (
    echo.
    echo [ERRO] Node.js nao encontrado.
    echo Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
  )
)

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call "%NPM_EXE%" install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha no npm install. Verifique sua internet e tente de novo.
    pause
    exit /b 1
  )
)

if not exist .env (
  copy .env.example .env >nul
)

echo.
echo ============================================================
echo   LUME AI - assistente pessoal
echo   Abrindo em http://localhost:3000
echo   Feche esta janela para parar o Lume AI.
echo ============================================================
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
"%NODE_EXE%" server/index.js

echo.
echo O Lume AI parou. Se apareceu algum erro acima, copie a mensagem.
pause >nul
