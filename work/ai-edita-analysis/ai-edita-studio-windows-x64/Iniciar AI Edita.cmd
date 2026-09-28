@echo off
setlocal
chcp 65001 >nul
title AI Edita Studio
cd /d "%~dp0"
echo Iniciando o AI Edita Studio...
if not exist "%~dp0runtime\node.exe" (
  echo.
  echo O runtime do AI Edita nao foi encontrado.
  echo Extraia novamente o ZIP completo antes de iniciar.
  echo.
  pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0launcher.mjs"
set "AI_EDITA_EXIT_CODE=%ERRORLEVEL%"
if not "%AI_EDITA_EXIT_CODE%"=="0" (
  echo.
  echo O AI Edita nao conseguiu iniciar.
  echo Consulte o diagnostico em %%LOCALAPPDATA%%\AI Edita\launcher.log
  echo.
  echo Pressione qualquer tecla para fechar.
  pause >nul
)
exit /b %AI_EDITA_EXIT_CODE%
