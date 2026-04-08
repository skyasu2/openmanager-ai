#!/usr/bin/env bash
# scripts/ci/runner-health-check.sh
# GitLab Runner + Docker 헬스 체크 → 문제 시 Windows 알림 발송
#
# 사용법:
#   bash scripts/ci/runner-health-check.sh          # 즉시 실행
#   bash scripts/ci/runner-health-check.sh --quiet  # 정상일 때 출력 없음
#
# 자동 실행 설정 (crontab):
#   crontab -e  →  */10 * * * * bash /mnt/d/dev/openmanager-ai/scripts/ci/runner-health-check.sh --quiet

set -euo pipefail

QUIET="${1:-}"
RUNNER_NAME="wsl2-docker"
ISSUES=()

# ─── 체크 함수 ────────────────────────────────────────────────────────────────

check_runner_service() {
  if ! systemctl is-active --quiet gitlab-runner 2>/dev/null; then
    ISSUES+=("gitlab-runner 서비스 중지됨")
    return 1
  fi
  return 0
}

check_docker_daemon() {
  if ! docker info &>/dev/null 2>&1; then
    ISSUES+=("Docker 데몬 미가동 (CI executor 동작 불가)")
    return 1
  fi
  return 0
}

check_pending_jobs() {
  # GitLab API로 pending 잡 수 조회 (GITLAB_TOKEN 환경변수 필요)
  if [[ -z "${GITLAB_TOKEN:-}" ]]; then
    return 0  # 토큰 없으면 스킵
  fi

  local project_id="80633738"
  local pending_count
  pending_count=$(curl -sf \
    --header "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
    "https://gitlab.com/api/v4/projects/${project_id}/jobs?scope=pending&per_page=1" \
    2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [[ "$pending_count" -gt 0 ]]; then
    ISSUES+=("GitLab에 pending 잡 ${pending_count}개 대기 중 (runner가 처리 못하고 있음)")
  fi
}

# ─── Windows 알림 발송 ────────────────────────────────────────────────────────

send_windows_notification() {
  local title="$1"
  local message="$2"

  # WSL2 → Windows PowerShell 경유 Toast 알림
  local ps_exe="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  if [[ -x "$ps_exe" ]]; then
    "$ps_exe" -NoProfile -NonInteractive -Command "
      \$notif = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
      \$template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
      \$xml = \$notif::GetTemplateContent(\$template)
      \$xml.GetElementsByTagName('text')[0].AppendChild(\$xml.CreateTextNode('${title}'))
      \$xml.GetElementsByTagName('text')[1].AppendChild(\$xml.CreateTextNode('${message}'))
      \$toast = [Windows.UI.Notifications.ToastNotification]::new(\$xml)
      \$notif::CreateToastNotifier('OpenManager AI CI').Show(\$toast)
    " 2>/dev/null && return 0
  fi

  # fallback: WSL2 터미널 bell + 출력
  echo -e "\007"
  echo "⚠️  [CI 알림] ${title}: ${message}" >&2
}

# ─── 메인 ────────────────────────────────────────────────────────────────────

check_runner_service || true
check_docker_daemon || true
check_pending_jobs || true

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  [[ "$QUIET" == "--quiet" ]] || echo "✅ CI runner 정상 (gitlab-runner 가동 중, Docker 정상)"
  exit 0
fi

# 문제 발견 시 알림 발송
SUMMARY=$(printf '%s\n' "${ISSUES[@]}" | head -3 | tr '\n' ' | ')
echo "❌ CI runner 문제 감지: ${SUMMARY}"

send_windows_notification \
  "⚠️ OpenManager AI CI 경고" \
  "${SUMMARY}"

exit 1
