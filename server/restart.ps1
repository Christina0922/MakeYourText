# 서버 재시작 스크립트
Write-Host "[서버 재시작] 시작..." -ForegroundColor Cyan

# 포트 5000을 사용하는 프로세스 종료
Write-Host "포트 5000 사용 프로세스 확인 중..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processes) {
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "프로세스 종료: PID $pid" -ForegroundColor Green
        } catch {
            Write-Host "프로세스 종료 실패: PID $pid - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "포트 5000을 사용하는 프로세스가 없습니다." -ForegroundColor Gray
}

# dist 폴더 삭제
if (Test-Path dist) {
    Write-Host "dist 폴더 삭제 중..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force dist
}

# 빌드
Write-Host "빌드 중..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "빌드 실패!" -ForegroundColor Red
    Read-Host "아무 키나 눌러 종료"
    exit 1
}

# 서버 시작
Write-Host "서버 시작 중..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "[서버 재시작] 완료!" -ForegroundColor Green
Write-Host "서버가 새 창에서 실행됩니다." -ForegroundColor Cyan
Start-Sleep -Seconds 2

