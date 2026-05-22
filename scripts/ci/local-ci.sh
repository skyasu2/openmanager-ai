#!/usr/bin/env bash
# local-ci.sh — 실제 GitLab shell executor 와 동일한 validate 체인을 로컬에서 직접 실행.
#
# 사용 이유:
#   GitLab CI validate job 은 wsl2-docker tag 의 shell executor 에서 실행됨.
#   shell executor = WSL2 시스템 Node 직접 사용 = 로컬 개발 환경과 동일.
#   ci:local:docker (Docker 컨테이너) 는 다른 환경을 시뮬레이션하므로 불필요.
#
# 이 스크립트가 실행하는 것 (= .gitlab-ci.yml validate + validate_ai_engine 과 동일):
#   npm run type-check
#   npm run lint:ci
#   npm run test:quick
#   npm run test:contract
#   npm run docs:components:verify
#   (cd cloud-run/ai-engine && npm run type-check && npm run test)
#
# 환경변수:
#   SKIP_AI_ENGINE=true   AI Engine 검증 건너뜀 (기본: false)
#   SKIP_CONTRACT=true    계약 테스트 건너뜀 (기본: false)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE_DIR="${ROOT_DIR}/cloud-run/ai-engine"
SKIP_AI_ENGINE="${SKIP_AI_ENGINE:-false}"
SKIP_CONTRACT="${SKIP_CONTRACT:-false}"

log() { printf '\033[0;36m[ci:local]\033[0m %s\n' "$*"; }
ok()  { printf '\033[0;32m✅ %s\033[0m\n' "$*"; }
err() { printf '\033[0;31m❌ %s\033[0m\n' "$*" >&2; }

cd "$ROOT_DIR"

log "▶ TypeScript 타입 검사..."
npm run type-check
ok "type-check 통과"

log "▶ Biome lint..."
npm run lint:ci
ok "lint 통과"

log "▶ 빠른 테스트..."
npm run test:quick
ok "test:quick 통과"

if [[ "$SKIP_CONTRACT" != "true" ]]; then
  log "▶ API/AI 계약 테스트..."
  npm run test:contract
  ok "test:contract 통과"
fi

log "▶ 컴포넌트 의존도 맵 검증..."
npm run docs:components:verify
ok "docs:components:verify 통과"

if [[ "$SKIP_AI_ENGINE" != "true" ]]; then
  log "▶ AI Engine 검증..."
  cd "$ENGINE_DIR"
  npm run type-check
  npm run test
  cd "$ROOT_DIR"
  ok "AI Engine 통과"
fi

ok "ci:local 전체 통과 (GitLab validate job 동등)"
