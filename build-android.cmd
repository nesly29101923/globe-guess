@echo off
cd /d "%~dp0"
git add -A
git commit -m "Build fix"
call npx eas-cli@latest build -p android --profile preview
echo.
echo Bitti. Bu pencereyi kapatabilirsin.
pause
