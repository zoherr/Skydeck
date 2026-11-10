@echo off
echo ========================================================
echo               Building Skydeck v3.0.0
echo ========================================================

echo [1/3] Compiling Go Backend...
cd backend
go build -ldflags="-s -w" -o ../electron/bin/skydeck-backend.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed!
    exit /b %ERRORLEVEL%
)
cd ..

echo [2/3] Building React + Tailwind Frontend...
cd frontend
call npm install
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    exit /b %ERRORLEVEL%
)
cd ..

echo [3/3] Packaging Electron Desktop Application (Windows NSIS)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron packaging failed!
    exit /b %ERRORLEVEL%
)

echo ========================================================
echo  Build complete! Installer generated in dist/
echo ========================================================
