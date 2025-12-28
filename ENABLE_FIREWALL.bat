@echo off
echo ================================================
echo OneOrigin Hub - Firewall Setup
echo ================================================
echo.
echo This will add a Windows Firewall rule to allow
echo incoming connections on port 3000.
echo.
echo Right-click this file and select "Run as administrator"
echo.
pause

netsh advfirewall firewall add rule name="OneOrigin Hub" dir=in action=allow protocol=TCP localport=3000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo SUCCESS! Firewall rule added.
    echo ================================================
    echo.
    echo Port 3000 is now accessible from other computers.
    echo You can now share the app with users on your network.
    echo.
) else (
    echo.
    echo ================================================
    echo ERROR: Failed to add firewall rule.
    echo ================================================
    echo.
    echo Please make sure you ran this as Administrator.
    echo Right-click the file and select "Run as administrator"
    echo.
)

pause
