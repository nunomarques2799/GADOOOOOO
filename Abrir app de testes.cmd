@echo off
REM ---------------------------------------------------------------------------
REM Abre a app Windows ligada a base de dados de TESTES.
REM
REM Duplo clique. Reconstroi com as alteracoes mais recentes (1-2 minutos) e
REM abre a app. NAO instala nada e NAO toca na "Gestao de Gado" instalada.
REM Ver AMBIENTES.md.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\desktop-dev.ps1"
if errorlevel 1 (
  echo.
  echo Algo correu mal. A janela fica aberta para poderes ler o erro acima.
  pause
)
