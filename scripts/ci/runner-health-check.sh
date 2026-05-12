#!/usr/bin/env bash
# scripts/ci/runner-health-check.sh
# 로컬 CI runner 프로세스와 Docker 가용 여부를 한 번 확인하고 결과를 exit code로 반환
#
# exit 0: 로컬 runner/Docker 정상
# exit 1: 로컬 runner/Docker 미가동 (CI 스킵 후 vercel --prod fallback 필요)
#
# 주의: 이 스크립트는 GitLab scheduler, pipeline 생성, runner tag matching,
# job 배정을 증명하지 않는다. push/tag 후에는 별도로
# `npm run gitlab:pipeline:head -- --wait` 결과를 확인해야 한다.
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
    echo "runner=ok docker=ok scope=local"
  fi
  exit 0
else
  if [[ "$QUIET" != "--quiet" ]]; then
    echo "runner=${RUNNER_OK} docker=${DOCKER_OK} scope=local"
  fi
  exit 1
fi
