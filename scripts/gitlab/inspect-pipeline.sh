#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_NAME="gitlab"
PIPELINE_ID=""
TARGET_SHA=""
GITLAB_API_BASE_URL="${GITLAB_API_BASE_URL:-https://gitlab.com/api/v4}"
GITLAB_CURL_CONNECT_TIMEOUT_SECONDS="${GITLAB_CURL_CONNECT_TIMEOUT_SECONDS:-10}"
GITLAB_CURL_MAX_TIME_SECONDS="${GITLAB_CURL_MAX_TIME_SECONDS:-30}"

usage() {
  cat <<'EOF'
Usage: bash scripts/gitlab/inspect-pipeline.sh [options]

Inspects a GitLab pipeline, its jobs, and resource-group queues.

Options:
  --pipeline <id>      Pipeline id to inspect
  --sha <commit>       Commit SHA to query when --pipeline is omitted (default: HEAD)
  --remote <name>      Git remote to inspect (default: gitlab)
  --help               Show this help

Token lookup order:
  1. GITLAB_TOKEN
  2. GL_TOKEN
  3. GLAB_TOKEN
  4. .env.local (same variable names, loaded only when no live token exists)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pipeline)
      PIPELINE_ID="${2:?missing pipeline id}"
      shift 2
      ;;
    --sha)
      TARGET_SHA="${2:?missing sha}"
      shift 2
      ;;
    --remote)
      REMOTE_NAME="${2:?missing remote name}"
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

gitlab_request() {
  local path="$1"
  local token="$2"

  curl -fsSL \
    --retry 3 \
    --retry-delay 1 \
    --connect-timeout "$GITLAB_CURL_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$GITLAB_CURL_MAX_TIME_SECONDS" \
    --header "PRIVATE-TOKEN: $token" \
    "${GITLAB_API_BASE_URL%/}${path}"
}

print_pipeline() {
  jq -r '"pipeline id=\(.id) status=\(.status) ref=\(.ref) sha=\(.sha) source=\(.source) duration=\((.duration // "none")) updated_at=\(.updated_at) url=\(.web_url)"'
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

ENCODED_PROJECT_PATH="$(printf '%s' "$PROJECT_PATH" | sed 's#/#%2F#g')"

if [[ -z "$PIPELINE_ID" ]]; then
  if [[ -z "$TARGET_SHA" ]]; then
    TARGET_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
  fi

  pipeline_json="$(
    gitlab_request \
      "/projects/${ENCODED_PROJECT_PATH}/pipelines?sha=${TARGET_SHA}&per_page=1" \
      "$GITLAB_TOKEN"
  )"
  PIPELINE_ID="$(printf '%s\n' "$pipeline_json" | jq -r 'if length == 0 then "" else .[0].id end')"

  if [[ -z "$PIPELINE_ID" ]]; then
    printf 'pipeline id=none status=not_created sha=%s ref=none updated_at=none url=none\n' "$TARGET_SHA"
    exit 0
  fi
fi

pipeline_json="$(gitlab_request "/projects/${ENCODED_PROJECT_PATH}/pipelines/${PIPELINE_ID}" "$GITLAB_TOKEN")"
jobs_json="$(
  gitlab_request \
    "/projects/${ENCODED_PROJECT_PATH}/pipelines/${PIPELINE_ID}/jobs?per_page=100" \
    "$GITLAB_TOKEN"
)"
resource_groups_json="$(gitlab_request "/projects/${ENCODED_PROJECT_PATH}/resource_groups?per_page=100" "$GITLAB_TOKEN")"

resource_queue_json="$(
  printf '%s\n' "$resource_groups_json" | jq -r '.[].key' | while read -r resource_group_key; do
    [[ -n "$resource_group_key" ]] || continue
    encoded_key="$(printf '%s' "$resource_group_key" | jq -sRr @uri)"
    gitlab_request \
      "/projects/${ENCODED_PROJECT_PATH}/resource_groups/${encoded_key}/upcoming_jobs?per_page=100" \
      "$GITLAB_TOKEN" |
      jq --arg resource_group "$resource_group_key" -c '.[] | . + {resource_group_key: $resource_group}'
  done | jq -s '.'
)"

printf '%s\n' "$pipeline_json" | print_pipeline

printf '\nJobs\n'
jq -r --argjson resourceQueue "$resource_queue_json" '
  def resource_group_for($jobId):
    ($resourceQueue[]? | select(.id == $jobId) | .resource_group_key) // "none";
  .[]
  | "job id=\(.id) name=\(.name) stage=\(.stage) status=\(.status) resource_group=\(resource_group_for(.id)) runner=\((.runner.description // .runner.id // "none")) queued_duration=\((.queued_duration // "none")) duration=\((.duration // "none")) started_at=\((.started_at // "none")) finished_at=\((.finished_at // "none")) url=\(.web_url)"
' <<<"$jobs_json"

printf '\nTiming Summary\n'
jq -r '
  def to_epoch:
    if . == null then
      null
    else
      (sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601)
    end;
  def fmt_seconds($value):
    if $value == null then
      "none"
    else
      (((($value * 100) | round) / 100 | tostring) + "s")
    end;
  def abs:
    if . < 0 then -. else . end;
  def started_jobs:
    [
      .[]
      | select(.started_at != null)
      | {
          name,
          stage,
          start: (.started_at | to_epoch),
          finish: (if .finished_at == null then null else (.finished_at | to_epoch) end),
          duration: (.duration // null)
        }
    ];

  started_jobs as $jobs
  | if ($jobs | length) == 0 then
      "- no_started_jobs"
    else
      (
        $jobs
        | group_by(.stage)[]
        | sort_by(.start) as $stageJobs
        | ($stageJobs | map(select(.finish != null))) as $finished
        | "stage_timing stage=\($stageJobs[0].stage) jobs=\($stageJobs | length) wall=\(fmt_seconds(if ($finished | length) == 0 then null else (($finished | max_by(.finish) | .finish) - ($stageJobs | min_by(.start) | .start)) end)) duration_sum=\(fmt_seconds($stageJobs | map(.duration // 0) | add))"
      ),
      (
        ($jobs | map(select(.name == "deploy" or .name == "deploy_ai_engine")) | sort_by(.name)) as $deployJobs
        | if ($deployJobs | length) == 2 and ($deployJobs[0].finish != null) and ($deployJobs[1].finish != null) then
            ($deployJobs[0]) as $a
            | ($deployJobs[1]) as $b
            | ([0, ([ $a.finish, $b.finish ] | min) - ([ $a.start, $b.start ] | max)] | max) as $overlap
            | (($a.start - $b.start) | abs) as $startDelta
            | "deploy_parallelism jobs=2 start_delta=\(fmt_seconds($startDelta)) overlap=\(fmt_seconds($overlap)) note=\(if $overlap > 0 then "overlap_detected" else "no_overlap_detected" end)"
          else
            "deploy_parallelism jobs=\($deployJobs | length) note=deploy_pair_not_observable"
          end
      )
    end
' <<<"$jobs_json"

printf '\nResource Queues\n'
if [[ "$(printf '%s\n' "$resource_queue_json" | jq 'length')" -eq 0 ]]; then
  printf '%s\n' "- none"
else
  jq -r '
    .[]
    | "resource_group=\(.resource_group_key) job=\(.name) job_id=\(.id) status=\(.status) pipeline=\(.pipeline.id) ref=\(.pipeline.ref) url=\(.web_url)"
  ' <<<"$resource_queue_json"
fi

printf '\nDiagnosis\n'
waiting_jobs="$(jq '[.[] | select(.status == "waiting_for_resource")]' <<<"$jobs_json")"
created_jobs_count="$(jq '[.[] | select(.status == "created")] | length' <<<"$jobs_json")"
pending_jobs_count="$(jq '[.[] | select(.status == "pending")] | length' <<<"$jobs_json")"
external_queue_count="$(
  jq --arg pipeline_id "$PIPELINE_ID" \
    '[.[] | select((.pipeline.id | tostring) != $pipeline_id)] | length' \
    <<<"$resource_queue_json"
)"

if [[ "$(jq 'length' <<<"$waiting_jobs")" -gt 0 ]]; then
  jq -r --argjson resourceQueue "$resource_queue_json" '
    def resource_group_for($jobId):
      ($resourceQueue[]? | select(.id == $jobId) | .resource_group_key) // "none";
    .[]
    | "- waiting_for_resource: job=\(.name) resource_group=\(resource_group_for(.id)) action=inspect_or_clear_resource_group_queue"
  ' <<<"$waiting_jobs"
fi

if [[ "$created_jobs_count" -gt 0 ]]; then
  printf -- '- created_jobs=%s note=likely_stage_blocked_until_prior_jobs_advance\n' "$created_jobs_count"
fi

if [[ "$pending_jobs_count" -gt 0 ]]; then
  printf -- '- pending_jobs=%s note=runner_assignment_or_capacity_wait\n' "$pending_jobs_count"
fi

if [[ "$external_queue_count" -gt 0 ]]; then
  printf -- '- external_resource_queue_entries=%s note=may_block_future_resource_group_jobs\n' "$external_queue_count"
fi

if [[ "$(jq 'length' <<<"$waiting_jobs")" -eq 0 && "$created_jobs_count" -eq 0 && "$pending_jobs_count" -eq 0 ]]; then
  printf '%s\n' "- no_waiting_jobs_detected"
fi
