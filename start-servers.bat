@echo off
echo Starting EscaShop servers...
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
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to continue...
pause >nul
