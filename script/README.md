# Exmate Board 배포 스크립트

이 폴더에는 Exmate Board 애플리케이션을 Docker로 쉽게 배포할 수 있는 쉘 스크립트가 있습니다.

## 파일 설명

- `deploy.sh`: Linux/macOS용 쉘 스크립트

## 사용 방법

### 1. 실행 권한 부여 (최초 1회만)

Linux/macOS에서 스크립트를 실행하기 전에 실행 권한을 부여해야 합니다:

```bash
chmod +x script/deploy.sh
```

### 2. 스크립트 실행

프로젝트 폴더에서 다음 명령어를 실행하세요:

```bash
./script/deploy.sh
```

또는

```bash
bash script/deploy.sh
```

## 스크립트가 수행하는 작업

1. **기존 컨테이너 정리**: 실행 중인 `my-board-container` 컨테이너를 중지하고 삭제
2. **기존 이미지 정리**: `exmate-board` 이미지를 삭제
3. **새 이미지 빌드**: 현재 코드로 새로운 Docker 이미지를 빌드
4. **새 컨테이너 실행**: 빌드된 이미지로 새 컨테이너를 실행
5. **상태 확인**: 컨테이너가 정상적으로 실행되었는지 확인

## 접속 방법

배포가 완료되면 웹 브라우저에서 다음 주소로 접속하세요:

**http://localhost:8080**

## 유용한 Docker 명령어

- **컨테이너 로그 확인**: `docker logs my-board-container`
- **컨테이너 중지**: `docker stop my-board-container`
- **컨테이너 삭제**: `docker rm my-board-container`
- **이미지 삭제**: `docker rmi exmate-board`
- **실행 중인 컨테이너 확인**: `docker ps`
- **모든 컨테이너 확인**: `docker ps -a`

## 문제 해결

### 스크립트 실행 권한 오류
스크립트 실행이 거부되는 경우:

```bash
chmod +x script/deploy.sh
```

### Docker가 실행되지 않는 경우
Docker가 설치되어 있고 실행 중인지 확인하세요:

```bash
docker --version
docker ps
```

### 포트 충돌
8080번 포트가 이미 사용 중인 경우, `deploy.sh` 파일에서 포트 번호를 변경하세요:

```bash
docker run -d -p 8081:80 --name my-board-container exmate-board
```

### Windows에서 실행하는 경우
Windows에서는 Git Bash, WSL, 또는 Docker Desktop의 터미널을 사용하세요. 