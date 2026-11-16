@echo off
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=%~dp0.tools\platform-tools\adb.exe"
set /p URL=<apk-url.txt
echo APK indiriliyor...
curl -L -o .tools\globe-guess.apk "%URL%"
echo Telefona kuruluyor (telefonda onay isterse "Yukle" de)...
"%ADB%" wait-for-device
"%ADB%" install -r .tools\globe-guess.apk
"%ADB%" logcat -c
"%ADB%" shell monkey -p com.trendforge.globeguess -c android.intent.category.LAUNCHER 1
timeout /t 15 /nobreak >nul
"%ADB%" logcat -d -v time > crash-log.txt
"%ADB%" exec-out screencap -p > .tools\screen.png
echo.
echo Bitti. Bu pencereyi kapatabilirsin.
pause
