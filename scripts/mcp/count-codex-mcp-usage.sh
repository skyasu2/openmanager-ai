#!/usr/bin/env bash
set -euo pipefail

# Count MCP tool calls from Codex CLI session JSONL files.
# Default sessions root: resolved CODEX_HOME/sessions

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ENV_RESOLVER="$REPO_ROOT/scripts/mcp/resolve-runtime-env.sh"
HOME_SESSIONS_ROOT="${HOME:-}/.codex/sessions"
PROJECT_SESSIONS_ROOT="$REPO_ROOT/.codex/sessions"

SESSIONS_ROOT=""
DAY_FILTER=""
TOP_N=20
USE_ALL_ROOTS=true

if [ -n "${CODEX_SESSIONS_ROOT:-}" ]; then
  SESSIONS_ROOT="$CODEX_SESSIONS_ROOT"
elif [ -f "$RUNTIME_ENV_RESOLVER" ]; then
  # shellcheck source=/dev/null
  source "$RUNTIME_ENV_RESOLVER" >/dev/null 2>&1 || true
  if [ -n "${CODEX_HOME:-}" ]; then
    SESSIONS_ROOT="$CODEX_HOME/sessions"
  fi
fi

if [ -z "$SESSIONS_ROOT" ]; then
  SESSIONS_ROOT="$HOME_SESSIONS_ROOT"
fi

usage() {
  cat <<'EOF'
Usage: bash scripts/mcp/count-codex-mcp-usage.sh [options]

Options:
  --root <path>        Codex sessions root (default: resolved CODEX_HOME/sessions)
  --all-roots          Scan both ~/.codex/sessions and ./.codex/sessions (default)
  --root-only          Scan only --root (or resolved default root)
  --day <YYYY-MM-DD>   Count only one day (event timestamp filter)
  --top <N>            Show top N tools (default: 20)
  -h, --help           Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --root)
      SESSIONS_ROOT="${2:-}"
      shift 2
      ;;
    --all-roots)
      USE_ALL_ROOTS=true
      shift
      ;;
    --root-only)
      USE_ALL_ROOTS=false
      shift
      ;;
    --day)
      DAY_FILTER="${2:-}"
      shift 2
      ;;
    --top)
      TOP_N="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! [[ "$TOP_N" =~ ^[0-9]+$ ]] || [ "$TOP_N" -le 0 ]; then
  echo "--top must be a positive integer" >&2
  exit 2
fi

if [ -n "$DAY_FILTER" ] && ! [[ "$DAY_FILTER" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "--day must be YYYY-MM-DD" >&2
  exit 2
fi

roots=()
if [ "$USE_ALL_ROOTS" = true ]; then
  roots+=("$HOME_SESSIONS_ROOT")
  roots+=("$PROJECT_SESSIONS_ROOT")
  if [ -n "$SESSIONS_ROOT" ]; then
    roots+=("$SESSIONS_ROOT")
  fi
else
  roots+=("$SESSIONS_ROOT")
fi

# Deduplicate roots while preserving order.
unique_roots=()
for r in "${roots[@]}"; do
  skip=false
  for seen in "${unique_roots[@]}"; do
    if [ "$r" = "$seen" ]; then
      skip=true
      break
    fi
  done
  if [ "$skip" = false ]; then
    unique_roots+=("$r")
  fi
done

mapfile -t all_files < <(
  for root in "${unique_roots[@]}"; do
    [ -d "$root" ] || continue
    find "$root" -type f -name '*.jsonl'
  done | sort -u
)

if [ "${#all_files[@]}" -eq 0 ]; then
  echo "Total MCP calls: 0"
  echo "No session files found under:"
  for root in "${unique_roots[@]}"; do
    echo "- $root"
  done
  exit 0
fi

files=("${all_files[@]}")

tmp_lines="$(mktemp)"
tmp_calls="$(mktemp)"
trap 'rm -f "$tmp_lines" "$tmp_calls"' EXIT

# Pattern A: direct function_call to mcp__*
rg -N '"type":"function_call".*"name":"mcp__[A-Za-z0-9._-]+__[A-Za-z0-9._-]+"' "${files[@]}" >"$tmp_lines" || true
# Pattern B: wrapped parallel calls with recipient_name="functions.mcp__*"
rg -N '"recipient_name":"functions\.mcp__[A-Za-z0-9._-]+__[A-Za-z0-9._-]+"' "${files[@]}" >>"$tmp_lines" || true

if [ -n "$DAY_FILTER" ]; then
  grep "\"timestamp\":\"$DAY_FILTER" "$tmp_lines" >"$tmp_calls" || true
  mv "$tmp_calls" "$tmp_lines"
  : >"$tmp_calls"
fi

sed -nE 's/.*"name":"(mcp__[A-Za-z0-9._-]+__[A-Za-z0-9._-]+)".*/\1/p' "$tmp_lines" >"$tmp_calls" || true
sed -nE 's/.*"recipient_name":"functions\.(mcp__[A-Za-z0-9._-]+__[A-Za-z0-9._-]+)".*/\1/p' "$tmp_lines" >>"$tmp_calls" || true

total_calls="$(wc -l <"$tmp_calls" | tr -d '[:space:]')"
echo "Total MCP calls: $total_calls"
if [ -n "$DAY_FILTER" ]; then
  echo "Day filter: $DAY_FILTER"
fi
echo "Sessions roots:"
for root in "${unique_roots[@]}"; do
  if [ -d "$root" ]; then
    echo "- $root (exists)"
  else
    echo "- $root (missing)"
  fi
done
echo "Session files scanned: ${#files[@]}"

if [ "$total_calls" -eq 0 ]; then
  exit 0
fi

echo
echo "By server:"
awk -F'__' '{print $2}' "$tmp_calls" | sort | uniq -c | sort -nr

echo
echo "Top tools (max $TOP_N):"
sort "$tmp_calls" | uniq -c | sort -nr | head -n "$TOP_N"
