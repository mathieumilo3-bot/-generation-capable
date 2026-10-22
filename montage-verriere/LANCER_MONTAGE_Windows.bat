@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PY=python
where py >nul 2>nul && set PY=py -3
%PY% --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python n'est pas installe. Installe-le depuis la page qui s'ouvre,
  echo en COCHANT la case "Add python.exe to PATH", puis relance ce fichier.
  start https://www.python.org/downloads/
  pause
  exit /b
)
echo Preparation des outils video (une seule fois)...
%PY% -m pip install --user --quiet --disable-pip-version-check imageio-ffmpeg pillow
%PY% montage_verriere.py %1
pause
