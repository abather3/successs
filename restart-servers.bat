@echo off
echo Restarting EscaShop servers...
echo.

echo Stopping existing node processes on ports 3000 and 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3000
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 5000
    taskkill /f /pid %%a >nul 2>&1
)

echo Waiting for processes to stop...
timeout /t 3 /nobreak >nul

echo.
echo Starting backend server...
cd backend
start "Backend Server" cmd /k "npm run dev"
cd ..

echo Starting frontend server...
cd frontend
start "Frontend Server" cmd /k "npm start"
cd ..

echo.
echo Both servers are restarting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Environment Configuration:
echo REACT_APP_API_URL=http://localhost:5000/api
echo.
echo Press any key to continue...
pause >nul
