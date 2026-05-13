#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CANONICAL_REMOTE="${CANONICAL_REMOTE:-gitlab}"
CANONICAL_BRANCH="${CANONICAL_BRANCH:-main}"

extract_pipeline_field() {
  local field="$1"
  local text="$2"
  local match

  match="$(grep -Eo "(^| )${field}=[^ ]+" <<<"$text" | tail -n 1 || true)"
  printf '%s\n' "${match#*=}"
}

is_nonterminal_pipeline_status() {
  case "$1" in
    created|pending|preparing|running|waiting_for_resource|scheduled)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

verify_gitlab_pipeline() {
  local pipeline_output
  local pipeline_exit=0
  local pipeline_id
  local pipeline_status

  echo "ℹ️ GitLab pipeline 상태를 확인합니다."
  pipeline_output="$(npm run --silent gitlab:pipeline:head -- --wait)" || pipeline_exit=$?
  printf '%s\n' "$pipeline_output"

  if [[ "$pipeline_exit" -ne 0 ]]; then
    echo "❌ GitLab pipeline 확인 실패: exit=$pipeline_exit"
    return "$pipeline_exit"
  fi

  pipeline_id="$(extract_pipeline_field "id" "$pipeline_output")"
  pipeline_status="$(extract_pipeline_field "status" "$pipeline_output")"

  if [[ "$pipeline_id" == "none" || -z "$pipeline_id" ]]; then
    echo "⚠️ GitLab pipeline이 생성되지 않았거나 확인할 수 없습니다."
    return 0
  fi

  if [[ "$pipeline_output" == *"note=pipeline_not_terminal_after_wait"* ]] || is_nonterminal_pipeline_status "$pipeline_status"; then
    echo "ℹ️ Pipeline이 아직 종료되지 않았습니다. jobs/resource queue를 진단합니다."
    npm run --silent gitlab:pipeline:inspect -- --pipeline "$pipeline_id" || {
      local inspect_exit=$?
      echo "⚠️ GitLab pipeline 상세 진단 실패: exit=$inspect_exit"
      return 0
    }
  fi
}

if bash scripts/ci/runner-health-check.sh --quiet; then
  echo "✅ 로컬 runner/Docker 상태 정상: CI 경유 배포를 진행합니다."
  git push --follow-tags "$CANONICAL_REMOTE" "$CANONICAL_BRANCH"
  verify_gitlab_pipeline
  echo "ℹ️ GitLab CI가 validate/deploy를 이어서 수행합니다."
  exit 0
fi

echo "⚠️ runner 미가동 감지: CI 게이트를 건너뛰고 Vercel 직접 배포로 전환합니다."
ALLOW_LOCAL_VERCEL_DEPLOY=true bash scripts/deploy/guard-canonical-deploy.sh
npx vercel --prod
echo "CI 게이트 스킵 후 직접 배포했습니다."
echo "runner가 미가동 상태였습니다."
