#!/bin/bash
# biome-wrapper.sh - Cross-platform Biome runner (Windows + WSL)
#
# 우선순위:
# 1. 프로젝트 로컬 node_modules - CI와 동일한 버전 보장
# 2. WSL 전역 설치 (~/.npm-global/bin/biome)
# 3. 시스템 PATH biome
# 4. 자동 설치 후 실행

set -e

# 프로젝트 루트 찾기
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# PATH에 WSL 전역 bin 추가
export PATH="$HOME/.npm-global/bin:$PATH"

find_working_biome() {
    # 1. 프로젝트 로컬 설치 확인 (CI와 동일한 버전 우선)
    if [ -x "$PROJECT_ROOT/node_modules/.bin/biome" ]; then
        if "$PROJECT_ROOT/node_modules/.bin/biome" --version &>/dev/null; then
            echo "$PROJECT_ROOT/node_modules/.bin/biome"
            return 0
        fi
    fi

    # 2. WSL 전역 설치 확인
    if [ -x "$HOME/.npm-global/bin/biome" ]; then
        if "$HOME/.npm-global/bin/biome" --version &>/dev/null; then
            echo "$HOME/.npm-global/bin/biome"
            return 0
        fi
    fi

    # 3. 시스템 PATH에서 확인
    if command -v biome &>/dev/null; then
        if biome --version &>/dev/null; then
            command -v biome
            return 0
        fi
    fi

    # 찾지 못함
    return 1
}

install_biome_globally() {
    # package.json에서 버전 추출
    BIOME_VERSION=$(grep -oP '"@biomejs/biome":\s*"\^?\K[0-9.]+' "$PROJECT_ROOT/package.json" || echo "2.3.14")
    echo "🔧 Biome not found. Installing version $BIOME_VERSION globally for WSL..."

    # WSL 전역 디렉토리 설정
    mkdir -p "$HOME/.npm-global/bin"
    npm config set prefix "$HOME/.npm-global" 2>/dev/null || true

    # 설치
    if npm install -g "@biomejs/biome@$BIOME_VERSION" 2>&1; then
        echo "✅ Biome $BIOME_VERSION installed successfully"
        return 0
    else
        echo "❌ Failed to install Biome"
        return 1
    fi
}

# Biome 찾기
BIOME_PATH=$(find_working_biome) || {
    install_biome_globally
    BIOME_PATH=$(find_working_biome) || {
        echo "❌ Could not find or install Biome. Using npx fallback..."
        exec npx @biomejs/biome "$@"
    }
}

# 실행
exec "$BIOME_PATH" "$@"
