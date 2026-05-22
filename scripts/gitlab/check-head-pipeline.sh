#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_NAME="gitlab"
TARGET_SHA=""
WAIT_FOR_COMPLETION=0
POLL_INTERVAL_SECONDS=15
MAX_ATTEMPTS=40
MAX_NOT_FOUND_ATTEMPTS=4
GITLAB_API_BASE_URL="${GITLAB_API_BASE_URL:-https://gitlab.com/api/v4}"
GITLAB_CURL_CONNECT_TIMEOUT_SECONDS="${GITLAB_CURL_CONNECT_TIMEOUT_SECONDS:-10}"
GITLAB_CURL_MAX_TIME_SECONDS="${GITLAB_CURL_MAX_TIME_SECONDS:-30}"

usage() {
  cat <<'EOF'
Usage: bash scripts/gitlab/check-head-pipeline.sh [options]

Checks the latest GitLab pipeline for the current HEAD SHA.

Options:
  --remote <name>      Git remote to inspect (default: gitlab)
  --sha <commit>       Commit SHA to query (default: git rev-parse HEAD)
  --wait               Poll until the pipeline reaches a terminal status
  --interval <secs>    Poll interval in seconds when --wait is set (default: 15)
  --attempts <count>      Max polling attempts when --wait is set (default: 40)
  --max-not-found <count> Exit with ci_skip_likely after N consecutive not_created (default: 4)
  --help               Show this help

Token lookup order:
  1. GITLAB_TOKEN
  2. GL_TOKEN
  3. GLAB_TOKEN
  4. .env.local (same variable names, loaded only when no live token exists)

Examples:
  bash scripts/gitlab/check-head-pipeline.sh
  bash scripts/gitlab/check-head-pipeline.sh --wait
  npm run gitlab:pipeline:head -- --wait

When --wait times out after observing a non-terminal pipeline, the script
prints that pipeline with note=pipeline_not_terminal_after_wait instead of
reporting not_created.

When --wait is still waiting for GitLab to create a pipeline for the SHA, the
script prints not_created progress lines with note=waiting_for_pipeline_creation.

When --max-not-found is set (default: 4), the script exits early with
note=ci_skip_likely after that many consecutive not_created responses. This
avoids 10-minute waits for docs/reports-only commits that never trigger CI.
EOF
}

print_pipeline_line() {
  local pipeline_id="$1"
  local pipeline_status="$2"
  local pipeline_sha="$3"
  local pipeline_ref="$4"
  local pipeline_updated_at="$5"
  local pipeline_url="$6"
  local pipeline_note="${7:-}"
  local pipeline_extra="${8:-}"

  printf 'id=%s status=%s sha=%s ref=%s updated_at=%s url=%s' \
    "$pipeline_id" \
    "$pipeline_status" \
    "$pipeline_sha" \
    "$pipeline_ref" \
    "$pipeline_updated_at" \
    "$pipeline_url"

  if [[ -n "$pipeline_note" ]]; then
    printf ' note=%s' "$pipeline_note"
  fi

  if [[ -n "$pipeline_extra" ]]; then
    printf ' %s' "$pipeline_extra"
  fi

  printf '\n'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      REMOTE_NAME="${2:?missing remote name}"
      shift 2
      ;;
    --sha)
      TARGET_SHA="${2:?missing sha}"
      shift 2
      ;;
    --wait)
      WAIT_FOR_COMPLETION=1
      shift
      ;;
    --interval)
      POLL_INTERVAL_SECONDS="${2:?missing interval seconds}"
      shift 2
      ;;
    --attempts)
      MAX_ATTEMPTS="${2:?missing attempt count}"
      shift 2
      ;;
    --max-not-found)
      MAX_NOT_FOUND_ATTEMPTS="${2:?missing not-found count}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

load_dotenv_if_needed() {
  if [[ -n "${GITLAB_TOKEN:-${GL_TOKEN:-${GLAB_TOKEN:-}}}" ]]; then
    return
  fi

  if [[ -f "$ROOT_DIR/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env.local"
    set +a
  fi
}

parse_project_path() {
  local raw="${1:-}"

  case "$raw" in
    git@gitlab.com:*.git)
      printf '%s\n' "${raw#git@gitlab.com:}" | sed 's/\.git$//'
      ;;
    git@gitlab.com:*)
      printf '%s\n' "${raw#git@gitlab.com:}"
      ;;
    https://gitlab.com/*.git|http://gitlab.com/*.git)
      printf '%s\n' "${raw#*://gitlab.com/}" | sed 's/\.git$//'
      ;;
    https://gitlab.com/*|http://gitlab.com/*)
      printf '%s\n' "${raw#*://gitlab.com/}"
      ;;
    */*)
      printf '%s\n' "$raw"
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_project_path() {
  local candidate=""

  if [[ -n "${GITLAB_PROJECT_URL:-}" ]]; then
    candidate="$(parse_project_path "$GITLAB_PROJECT_URL" || true)"
  fi

  if [[ -z "$candidate" && -n "${GITLAB_REMOTE_URL:-}" ]]; then
    candidate="$(parse_project_path "$GITLAB_REMOTE_URL" || true)"
  fi

  if [[ -z "$candidate" ]]; then
    local remote_url=""
    remote_url="$(git -C "$ROOT_DIR" remote get-url --push "$REMOTE_NAME" 2>/dev/null || true)"
    candidate="$(parse_project_path "$remote_url" || true)"
  fi

  printf '%s\n' "$candidate"
}

pipeline_request() {
  local encoded_project_path="$1"
  local sha="$2"
  local token="$3"

  curl -fsSL \
    --retry 3 \
    --retry-delay 1 \
    --connect-timeout "$GITLAB_CURL_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$GITLAB_CURL_MAX_TIME_SECONDS" \
    --header "PRIVATE-TOKEN: $token" \
    "${GITLAB_API_BASE_URL%/}/projects/${encoded_project_path}/pipelines?sha=${sha}&per_page=1"
}

pipeline_line_from_json() {
  jq -r 'if length == 0 or .[0] == null then "" else
    "id=\(.[0].id) status=\(.[0].status) sha=\(.[0].sha) ref=\(.[0].ref) updated_at=\(.[0].updated_at) url=\(.[0].web_url)"
  end'
}

pipeline_status_from_line() {
  local line="$1"
  printf '%s\n' "$line" | sed -n 's/.* status=\([^ ]*\).*/\1/p'
}

is_running_status() {
  case "$1" in
    created|pending|preparing|running|waiting_for_resource|scheduled)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

load_dotenv_if_needed

GITLAB_TOKEN="${GITLAB_TOKEN:-${GL_TOKEN:-${GLAB_TOKEN:-}}}"
if [[ -z "$GITLAB_TOKEN" ]]; then
  echo "ERROR: GitLab token not found. Set GITLAB_TOKEN/GL_TOKEN/GLAB_TOKEN or add GITLAB_TOKEN to .env.local." >&2
  exit 1
fi

PROJECT_PATH="$(resolve_project_path)"
if [[ -z "$PROJECT_PATH" ]]; then
  echo "ERROR: Could not determine GitLab project path from env or remote '$REMOTE_NAME'." >&2
  exit 1
fi

if [[ -z "$TARGET_SHA" ]]; then
  TARGET_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
fi

CURRENT_REF="$(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true)"
if [[ -z "$CURRENT_REF" ]]; then
  CURRENT_REF="detached"
fi

ENCODED_PROJECT_PATH="$(printf '%s' "$PROJECT_PATH" | sed 's#/#%2F#g')"

attempt=1
not_found_streak=0
last_pipeline_line=""
while true; do
  pipeline_json="$(pipeline_request "$ENCODED_PROJECT_PATH" "$TARGET_SHA" "$GITLAB_TOKEN")"
  pipeline_line="$(printf '%s\n' "$pipeline_json" | pipeline_line_from_json)"

  if [[ -n "$pipeline_line" ]]; then
    not_found_streak=0
    last_pipeline_line="$pipeline_line"
    pipeline_status="$(pipeline_status_from_line "$pipeline_line")"
    printf '%s\n' "$pipeline_line"

    if [[ "$WAIT_FOR_COMPLETION" -eq 0 ]]; then
      exit 0
    fi

    if ! is_running_status "$pipeline_status"; then
      if [[ "$pipeline_status" == "success" ]]; then
        exit 0
      fi
      exit 2
    fi
  else
    if [[ "$WAIT_FOR_COMPLETION" -eq 0 ]]; then
      print_pipeline_line \
        "none" \
        "not_created" \
        "$TARGET_SHA" \
        "$CURRENT_REF" \
        "none" \
        "none" \
        "no_pipeline_found_for_sha"
      exit 0
    fi

    not_found_streak=$((not_found_streak + 1))

    print_pipeline_line \
      "none" \
      "not_created" \
      "$TARGET_SHA" \
      "$CURRENT_REF" \
      "none" \
      "none" \
      "waiting_for_pipeline_creation" \
      "attempt=$attempt"

    if (( MAX_NOT_FOUND_ATTEMPTS > 0 && not_found_streak >= MAX_NOT_FOUND_ATTEMPTS )); then
      print_pipeline_line \
        "none" \
        "not_created" \
        "$TARGET_SHA" \
        "$CURRENT_REF" \
        "none" \
        "none" \
        "ci_skip_likely" \
        "not_found_streak=$not_found_streak hint=docs_reports_only_commit_or_no_path_match"
      exit 0
    fi
  fi

  if (( attempt >= MAX_ATTEMPTS )); then
    if [[ -n "$last_pipeline_line" ]]; then
      printf '%s note=pipeline_not_terminal_after_wait attempts=%s\n' \
        "$last_pipeline_line" \
        "$MAX_ATTEMPTS"
      exit 0
    fi

    print_pipeline_line \
      "none" \
      "not_created" \
      "$TARGET_SHA" \
      "$CURRENT_REF" \
      "none" \
      "none" \
      "no_pipeline_found_after_wait" \
      "attempts=$MAX_ATTEMPTS"
    exit 0
  fi

  attempt=$((attempt + 1))
  sleep "$POLL_INTERVAL_SECONDS"
done
