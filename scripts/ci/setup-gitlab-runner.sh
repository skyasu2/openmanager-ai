#!/usr/bin/env bash
# GitLab Runner WSL2 셀프 호스트 설치 스크립트
# 효과: GitLab CI job을 WSL2 shell runner로 실행 → GitLab.com shared runner 분 소진 0
#
# 사전 조건:
#   - WSL2 Ubuntu + systemd
#   - GitLab project → Settings → CI/CD → Runners → "New project runner" 에서 토큰 발급
#
# 사용법:
#   bash scripts/ci/setup-gitlab-runner.sh <runner-token>
#   예: bash scripts/ci/setup-gitlab-runner.sh glrt-xxxxxxxxxxxx
#
# 토큰 발급 위치:
#   https://gitlab.com/skyasu2/openmanager-ai/-/settings/ci_cd
#   → Runners → "New project runner" → OS: Linux, Tags: wsl2-docker → Create runner

set -euo pipefail

RUNNER_NAME="${RUNNER_NAME:-wsl2-docker}"
RUNNER_TAGS="${RUNNER_TAGS:-wsl2-docker}"
GITLAB_URL="${GITLAB_URL:-https://gitlab.com}"
REGISTRATION_TOKEN="${1:-}"

log()   { echo "[setup-gitlab-runner] $*"; }
error() { echo "[setup-gitlab-runner] ERROR: $*" >&2; exit 1; }

check_prerequisites() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "✓ Docker: OK (local Docker CI / deploy fallback available)"
  else
    log "⚠ Docker unavailable. Runner registration continues, but local Docker CI / deploy fallback는 별도 복구가 필요합니다."
  fi

  if [ -z "$REGISTRATION_TOKEN" ]; then
    log ""
    log "Runner token이 필요합니다."
    log "발급 방법:"
    log "  1. https://gitlab.com/skyasu2/openmanager-ai/-/settings/ci_cd 접속"
    log "  2. Runners → 'New project runner'"
    log "  3. OS: Linux, Tags: wsl2-docker (checked), 설명 입력"
    log "  4. 'Create runner' → 표시된 토큰(glrt-xxxxx) 복사"
    log ""
    log "사용법: $0 <glrt-xxxxxxxxxx>"
    exit 1
  fi

  # 토큰 형식 검사 (신규 형식: glrt-, 구형: GR1xxx-)
  if [[ "$REGISTRATION_TOKEN" != glrt-* && "$REGISTRATION_TOKEN" != GR1* ]]; then
    log "⚠ 토큰 형식이 예상과 다릅니다. 계속 진행합니다."
  fi
}

install_gitlab_runner() {
  if command -v gitlab-runner >/dev/null 2>&1; then
    log "✓ gitlab-runner already installed: $(gitlab-runner --version | head -1)"
    return
  fi

  log "gitlab-runner 설치 중 (apt)..."
  curl -fsSL \
    "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" \
    | sudo bash
  sudo apt-get install -y gitlab-runner
  log "✓ gitlab-runner 설치 완료: $(gitlab-runner --version | head -1)"
}

register_runner() {
  # 이미 등록된 runner가 있으면 스킵
  if sudo gitlab-runner list 2>&1 | grep -q "$RUNNER_NAME"; then
    log "✓ Runner '$RUNNER_NAME' 이미 등록됨. 스킵."
    return
  fi

  log "Runner 등록 중..."
  sudo gitlab-runner register \
    --non-interactive \
    --url "$GITLAB_URL" \
    --token "$REGISTRATION_TOKEN" \
    --executor shell \
    --description "$RUNNER_NAME" \
    --tag-list "$RUNNER_TAGS" \
    --run-untagged=false \
    --locked=false

  log "✓ Runner 등록 완료."
}

start_runner_service() {
  if systemctl is-system-running >/dev/null 2>&1; then
    sudo gitlab-runner install --user=gitlab-runner 2>/dev/null || true
    sudo systemctl enable gitlab-runner
    sudo systemctl restart gitlab-runner
    sleep 2
    if systemctl is-active --quiet gitlab-runner; then
      log "✓ gitlab-runner 서비스 실행 중 (systemd)"
    else
      log "⚠ 서비스 시작 실패. 수동 확인: sudo systemctl status gitlab-runner"
    fi
  else
    log "systemd 미사용 환경 감지. 수동 시작 필요:"
    log "  nohup sudo gitlab-runner run > /tmp/gitlab-runner.log 2>&1 &"
  fi
}

verify_runner() {
  log "Runner 연결 확인..."
  sleep 3
  if sudo gitlab-runner verify 2>&1 | grep -q "is alive"; then
    log "✓ Runner GitLab 연결 확인됨."
  else
    log "⚠ verify 실패. 잠시 후 수동 확인:"
    log "  sudo gitlab-runner verify"
    log "  sudo systemctl status gitlab-runner"
  fi
}

print_summary() {
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "✅ GitLab Runner 설정 완료"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "  Runner:   $RUNNER_NAME"
  log "  Tags:     $RUNNER_TAGS"
  log "  Executor: shell"
  log "  Service:  systemd (자동 시작)"
  log ""
  log "다음 단계:"
  log "  1. git push gitlab main  (코드 변경 포함)"
  log "  2. GitLab 파이프라인에서 validate/deploy job이 wsl2-docker runner로 실행 확인"
  log "  3. semver tag(v*.*.*) deploy를 쓰면 GitLab protected tags에도 같은 패턴 등록"
  log "  4. current policy: validate/deploy/smoke 모두 self-hosted runner 0분 소진"
  log ""
  log "서비스 관리:"
  log "  sudo systemctl status gitlab-runner"
  log "  sudo systemctl stop gitlab-runner"
  log "  sudo gitlab-runner list"
}

main() {
  check_prerequisites
  install_gitlab_runner
  register_runner
  start_runner_service
  verify_runner
  print_summary
}

main "$@"
