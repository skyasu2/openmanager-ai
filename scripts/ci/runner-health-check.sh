#!/usr/bin/env bash
# scripts/ci/runner-health-check.sh
# 로컬 GitLab runner 프로세스를 확인하고 exit code로 반환.
#
# exit 0: runner 정상 → CI 경유 태그 push로 배포 가능
# exit 1: runner 미가동 → runner 복구 후 tag pipeline 재시도 필요
#
# Docker 상태는 부가 정보로만 출력 (exit code에 영향 없음).
# 이유: GitLab CI 는 wsl2-docker tag 의 shell executor 사용.
#       shell executor 는 Docker daemon 불필요. Docker 는 cloud-run/ai-engine
#       배포(deploy.sh) 및 docker:preflight 용도로만 필요.
#
# 주의: 이 스크립트는 GitLab scheduler, pipeline 생성, runner tag matching,
# job 배정을 증명하지 않는다. push/tag 후에는 별도로
# `npm run gitlab:pipeline:head -- --wait` 결과를 확인해야 한다.
#
# 사용:
#   if bash scripts/ci/runner-health-check.sh; then
#     <CI 경유 정상 배포>
#   else
#     <runner 복구 → tag pipeline 재시도/재확인>
#   fi

set -euo pipefail

QUIET="${1:-}"
RUNNER_OK=true
DOCKER_OK=true
RUNNER_MAX_BUILDS="unknown"
RELEASE_PARALLELISM="unknown"

# gitlab-runner 서비스/프로세스 확인 (exit code 기준)
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

# Docker 데몬 확인 (부가 정보 — exit code 에 영향 없음)
if ! docker info &>/dev/null 2>&1; then
  DOCKER_OK=false
fi

if command -v journalctl >/dev/null 2>&1; then
  latest_max_builds="$(
    journalctl -u gitlab-runner -n 200 --no-pager 2>/dev/null \
      | sed -n 's/.*max_builds=\([0-9][0-9]*\).*/\1/p' \
      | tail -n 1 \
      || true
  )"

  if [[ -n "$latest_max_builds" ]]; then
    RUNNER_MAX_BUILDS="$latest_max_builds"
    if [[ "$RUNNER_MAX_BUILDS" -le 1 ]]; then
      RELEASE_PARALLELISM="runner_capacity_limited"
    else
      RELEASE_PARALLELISM="runner_capacity_available"
    fi
  fi
fi

if [[ "$QUIET" != "--quiet" ]]; then
  echo "runner=${RUNNER_OK} docker=${DOCKER_OK} scope=local runner_max_builds=${RUNNER_MAX_BUILDS} release_parallelism=${RELEASE_PARALLELISM}"
fi

# exit code 는 runner 상태만으로 결정 (Docker 무관)
if $RUNNER_OK; then
  exit 0
else
  exit 1
fi
