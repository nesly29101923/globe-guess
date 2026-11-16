@echo off
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=%~dp0.tools\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo adb indiriliyor...
  mkdir .tools 2>nul
  curl -L -o .tools\pt.zip https://dl.google.com/android/repository/platform-tools-latest-windows.zip
  tar -xf .tools\pt.zip -C .tools
)
"%ADB%" start-server
echo.
echo Telefonu USB kabloyla bagla. Telefonda "USB hata ayiklamaya izin verilsin mi?" sorusu cikarsa "Izin ver" de.
"%ADB%" wait-for-device
"%ADB%" logcat -c
echo Oyun aciliyor...
"%ADB%" shell monkey -p com.trendforge.globeguess -c android.intent.category.LAUNCHER 1
timeout /t 12 /nobreak >nul
"%ADB%" logcat -d -v time > crash-log.txt
echo.
echo Bitti: crash-log.txt olusturuldu. Bu pencereyi kapatabilirsin.
pause
