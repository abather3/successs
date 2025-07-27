@echo off
echo Checking for processes using port 5000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Killing process with PID: %%a
    taskkill /PID %%a /F
)

echo Done! Port 5000 should now be available.
pause
