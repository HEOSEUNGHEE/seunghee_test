# Exmate Board 배포 스크립트
# 이 스크립트는 Docker 컨테이너를 정리하고 새로 빌드한 후 실행합니다.

Write-Host "=== Exmate Board 배포 시작 ===" -ForegroundColor Green

# 1. 기존 컨테이너 정리
Write-Host "1. 기존 컨테이너 정리 중..." -ForegroundColor Yellow

# 기존 컨테이너가 실행 중이면 중지
$containerExists = docker ps -a --filter "name=my-board-container" --format "table {{.Names}}" | Select-String "my-board-container"
if ($containerExists) {
    Write-Host "   기존 컨테이너 중지 중..." -ForegroundColor Cyan
    docker stop my-board-container
    Write-Host "   기존 컨테이너 삭제 중..." -ForegroundColor Cyan
    docker rm my-board-container
    Write-Host "   기존 컨테이너 정리 완료" -ForegroundColor Green
} else {
    Write-Host "   실행 중인 컨테이너가 없습니다." -ForegroundColor Cyan
}

# 2. 기존 이미지 삭제 (선택사항)
Write-Host "2. 기존 이미지 정리 중..." -ForegroundColor Yellow
$imageExists = docker images --filter "reference=exmate-board" --format "table {{.Repository}}" | Select-String "exmate-board"
if ($imageExists) {
    Write-Host "   기존 이미지 삭제 중..." -ForegroundColor Cyan
    docker rmi exmate-board
    Write-Host "   기존 이미지 삭제 완료" -ForegroundColor Green
} else {
    Write-Host "   기존 이미지가 없습니다." -ForegroundColor Cyan
}

# 3. 새 이미지 빌드
Write-Host "3. 새 Docker 이미지 빌드 중..." -ForegroundColor Yellow
docker build -t exmate-board .
if ($LASTEXITCODE -eq 0) {
    Write-Host "   이미지 빌드 완료" -ForegroundColor Green
} else {
    Write-Host "   이미지 빌드 실패!" -ForegroundColor Red
    exit 1
}

# 4. 새 컨테이너 실행
Write-Host "4. 새 컨테이너 실행 중..." -ForegroundColor Yellow
docker run -d -p 8080:80 --name my-board-container exmate-board
if ($LASTEXITCODE -eq 0) {
    Write-Host "   컨테이너 실행 완료" -ForegroundColor Green
} else {
    Write-Host "   컨테이너 실행 실패!" -ForegroundColor Red
    exit 1
}

# 5. 컨테이너 상태 확인
Write-Host "5. 컨테이너 상태 확인 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$containerStatus = docker ps --filter "name=my-board-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host "   컨테이너 상태:" -ForegroundColor Cyan
Write-Host $containerStatus -ForegroundColor White

# 6. 배포 완료 메시지
Write-Host "=== 배포 완료! ===" -ForegroundColor Green
Write-Host "웹 브라우저에서 http://localhost:8080 으로 접속하세요." -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "유용한 명령어:" -ForegroundColor Yellow
Write-Host "  - 컨테이너 로그 확인: docker logs my-board-container" -ForegroundColor White
Write-Host "  - 컨테이너 중지: docker stop my-board-container" -ForegroundColor White
Write-Host "  - 컨테이너 삭제: docker rm my-board-container" -ForegroundColor White 