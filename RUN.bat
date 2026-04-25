@echo off
setlocal

REM Always run from this script's directory.
cd /d "%~dp0"

REM Ensure npm is available before continuing.
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo Install Node.js and reopen this script from a new terminal.
  pause
  exit /b 1
)

REM If a dev server is already running, open it and exit.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 2; if ($r.Content -match '__next') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://localhost:3000"
  echo Existing dev server detected on port 3000. Browser opened.
  exit /b 0
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001' -TimeoutSec 2; if ($r.Content -match '__next') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://localhost:3001"
  echo Existing dev server detected on port 3001. Browser opened.
  exit /b 0
)

REM Start dev server in a separate window so we can wait and open browser.
start "AI Music Creator Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo Waiting for Next.js dev server (ports 3000/3001) ...
set "max_attempts=60"
set "attempt=0"

:wait_for_server
powershell -NoProfile -Command "$ok=$false; foreach($p in 3000,3001){ try { $r = Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:'+$p) -TimeoutSec 2; if($r.Content -match '__next'){ $ok=$true; Write-Output $p; break } } catch {} }; if($ok){ exit 0 } else { exit 1 }" > "%temp%\ai-music-tool-port.txt" 2>nul
if not errorlevel 1 goto open_browser

set /a attempt+=1
if %attempt% GEQ %max_attempts% goto timeout
timeout /t 1 /nobreak >nul
goto wait_for_server

:open_browser
set /p APP_PORT=<"%temp%\ai-music-tool-port.txt"
if "%APP_PORT%"=="" set "APP_PORT=3000"
start "" "http://localhost:%APP_PORT%"
echo Server is up on port %APP_PORT%. Browser opened.
exit /b 0

:timeout
echo [WARN] Timed out waiting for the dev server.
echo You can still open http://localhost:3000 manually once it starts.
pause
exit /b 1