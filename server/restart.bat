@echo off
echo [서버 재시작] 시작...

REM 포트 5000을 사용하는 프로세스 종료
echo 포트 5000 사용 프로세스 확인 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo 프로세스 종료: PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM dist 폴더 삭제
if exist dist (
    echo dist 폴더 삭제 중...
    rmdir /s /q dist
)

REM 빌드
echo 빌드 중...
call npm run build
if errorlevel 1 (
    echo 빌드 실패!
    pause
    exit /b 1
)

REM 서버 시작
echo 서버 시작 중...
start "MakeYourText Server" cmd /k "npm start"

echo.
echo [서버 재시작] 완료!
echo 서버가 새 창에서 실행됩니다.
timeout /t 3 >nul

