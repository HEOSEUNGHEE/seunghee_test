@echo off
chcp 65001 >nul
echo === Exmate Board 배포 시작 ===

echo 1. 기존 컨테이너 정리 중...
docker stop my-board-container 2>nul
docker rm my-board-container 2>nul
echo    기존 컨테이너 정리 완료

echo 2. 기존 이미지 정리 중...
docker rmi exmate-board 2>nul
echo    기존 이미지 정리 완료

echo 3. 새 Docker 이미지 빌드 중...
docker build -t exmate-board .
if %errorlevel% neq 0 (
    echo    이미지 빌드 실패!
    pause
    exit /b 1
)
echo    이미지 빌드 완료

echo 4. 새 컨테이너 실행 중...
docker run -d -p 8080:80 --name my-board-container exmate-board
if %errorlevel% neq 0 (
    echo    컨테이너 실행 실패!
    pause
    exit /b 1
)
echo    컨테이너 실행 완료

echo 5. 컨테이너 상태 확인 중...
timeout /t 3 /nobreak >nul
docker ps --filter "name=my-board-container"

echo === 배포 완료! ===
echo 웹 브라우저에서 http://localhost:8080 으로 접속하세요.
echo.
echo 유용한 명령어:
echo   - 컨테이너 로그 확인: docker logs my-board-container
echo   - 컨테이너 중지: docker stop my-board-container
echo   - 컨테이너 삭제: docker rm my-board-container
pause 