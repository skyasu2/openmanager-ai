#!/usr/bin/env bash
# scripts/ci/runner-health-check.sh
# CI runner 가용 여부를 한 번 확인하고 결과를 exit code로 반환
#
# exit 0: runner 정상 (CI 게이트 통과 가능)
# exit 1: runner/Docker 미가동 (CI 스킵 후 vercel --prod fallback 필요)
#
# AI 배포 흐름에서 사용:
#   if bash scripts/ci/runner-health-check.sh; then
#     <CI 경유 정상 배포>
#   else
#     <CI 스킵 → vercel --prod 직접 배포 → 사용자에게 스킵 사실 보고>
#   fi

set -euo pipefail

RUNNER_OK=true
DOCKER_OK=true

# gitlab-runner 서비스 확인
if ! systemctl is-active --quiet gitlab-runner 2>/dev/null; then
  RUNNER_OK=false
fi

# Docker 데몬 확인 (shell executor는 Docker 불필요하지만 명시적 체크)
if ! docker info &>/dev/null 2>&1; then
  DOCKER_OK=false
fi

if $RUNNER_OK; then
  echo "runner=ok"
  exit 0
else
  echo "runner=down docker=${DOCKER_OK}"
  exit 1
fi
