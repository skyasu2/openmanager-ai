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

QUIET="${1:-}"
RUNNER_OK=true
DOCKER_OK=true

# gitlab-runner 서비스/프로세스 확인
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet gitlab-runner 2>/dev/null; then
    RUNNER_OK=false
  fi
else
  RUNNER_OK=false
fi

if ! $RUNNER_OK && command -v pgrep >/dev/null 2>&1; then
  if pgrep -f '[g]itlab-runner' >/dev/null 2>&1; then
    RUNNER_OK=true
  fi
fi

# Docker 데몬 확인 (shell executor는 Docker 불필요하지만 명시적 체크)
if ! docker info &>/dev/null 2>&1; then
  DOCKER_OK=false
fi

if $RUNNER_OK && $DOCKER_OK; then
  if [[ "$QUIET" != "--quiet" ]]; then
    echo "runner=ok docker=ok"
  fi
  exit 0
else
  if [[ "$QUIET" != "--quiet" ]]; then
    echo "runner=${RUNNER_OK} docker=${DOCKER_OK}"
  fi
  exit 1
fi
