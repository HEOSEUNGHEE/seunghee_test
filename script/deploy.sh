#!/bin/bash

# Exmate Board 배포 스크립트
# 이 스크립트는 Docker 컨테이너를 정리하고 새로 빌드한 후 실행합니다.

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 함수: 색상 출력
print_status() {
    echo -e "${GREEN}=== Exmate Board 배포 시작 ===${NC}"
}

print_step() {
    echo -e "${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_info() {
    echo -e "${CYAN}$1${NC}"
}

# 메인 스크립트 시작
print_status

# 1. 기존 컨테이너 정리
print_step "1. 기존 컨테이너 정리 중..."

# 기존 컨테이너가 실행 중이면 중지
if docker ps -a --filter "name=my-board-container" --format "table {{.Names}}" | grep -q "my-board-container"; then
    print_info "   기존 컨테이너 중지 중..."
    docker stop my-board-container
    print_info "   기존 컨테이너 삭제 중..."
    docker rm my-board-container
    print_success "   기존 컨테이너 정리 완료"
else
    print_info "   실행 중인 컨테이너가 없습니다."
fi

# 2. 기존 이미지 삭제 (선택사항)
print_step "2. 기존 이미지 정리 중..."
if docker images --filter "reference=exmate-board" --format "table {{.Repository}}" | grep -q "exmate-board"; then
    print_info "   기존 이미지 삭제 중..."
    docker rmi exmate-board
    print_success "   기존 이미지 삭제 완료"
else
    print_info "   기존 이미지가 없습니다."
fi

# 3. 새 이미지 빌드
print_step "3. 새 Docker 이미지 빌드 중..."
if docker build -t exmate-board .; then
    print_success "   이미지 빌드 완료"
else
    print_error "   이미지 빌드 실패!"
    exit 1
fi

# 4. 새 컨테이너 실행
print_step "4. 새 컨테이너 실행 중..."
if docker run -d -p 8080:80 --name my-board-container exmate-board; then
    print_success "   컨테이너 실행 완료"
else
    print_error "   컨테이너 실행 실패!"
    exit 1
fi

# 5. 컨테이너 상태 확인
print_step "5. 컨테이너 상태 확인 중..."
sleep 3
container_status=$(docker ps --filter "name=my-board-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
print_info "   컨테이너 상태:"
echo "$container_status"

# 6. 배포 완료 메시지
print_success "=== 배포 완료! ==="
print_info "웹 브라우저에서 http://localhost:8080 으로 접속하세요."
echo ""
print_step "유용한 명령어:"
echo "  - 컨테이너 로그 확인: docker logs my-board-container"
echo "  - 컨테이너 중지: docker stop my-board-container"
echo "  - 컨테이너 삭제: docker rm my-board-container" 