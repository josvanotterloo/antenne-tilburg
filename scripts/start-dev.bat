@echo off
chcp 65001 >nul
title Antenne - lokale testversie
cd /d "%~dp0.."

echo ============================================
echo   Antenne - laatste versie ophalen en starten
echo ============================================
echo.

echo [1/4] Laatste versie ophalen van GitHub...
git pull --ff-only
if errorlevel 1 goto pull_error

echo.
echo [2/4] Pakketten bijwerken...
call npm install
if errorlevel 1 goto generic_error

echo.
echo [3/4] Database bijwerken...
call npx prisma migrate deploy
if errorlevel 1 goto generic_error
call npx prisma generate >nul 2>&1

echo.
echo [4/4] Server starten...
echo.
echo   De site opent zo vanzelf in je browser: http://localhost:3000
echo   LAAT DIT VENSTER OPEN STAAN tijdens het testen.
echo   Klaar? Sluit dit venster om de server te stoppen.
echo.

rem Open de browser pas na ~8 seconden, terwijl de server opstart.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 8; Start-Process 'http://localhost:3000'"

call npm run dev
goto end

:pull_error
echo.
echo *** Kon de laatste versie niet ophalen. ***
echo   Controleer je internetverbinding en probeer het opnieuw.
echo   Blijft dit gebeuren? Bel Jos even.
echo.
pause
goto end

:generic_error
echo.
echo *** Er ging iets mis bij het voorbereiden. ***
echo   Maak een schermafbeelding van dit venster en stuur die naar Jos.
echo.
pause
goto end

:end
