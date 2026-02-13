#!/usr/bin/env bash
set -euo pipefail

# Count MCP tool calls from Codex CLI session JSONL files.
# Default sessions root: ~/.codex/sessions

SESSIONS_ROOT="${CODEX_SESSIONS_ROOT:-$HOME/.codex/sessions}"
DAY_FILTER=""
TOP_N=20

usage() {
  cat <<'EOF'
Usage: bash scripts/mcp/count-codex-mcp-usage.sh [options]

Options:
  --root <path>        Codex sessions root (default: ~/.codex/sessions)
  --day <YYYY-MM-DD>   Count only one day (path filter: YYYY/MM/DD)
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
      usage
      exit 2
      ;;
  esac
done

if [ ! -d "$SESSIONS_ROOT" ]; then
  echo "Sessions root not found: $SESSIONS_ROOT" >&2
  exit 2
fi

if ! [[ "$TOP_N" =~ ^[0-9]+$ ]] || [ "$TOP_N" -le 0 ]; then
  echo "--top must be a positive integer" >&2
  exit 2
fi

if [ -n "$DAY_FILTER" ] && ! [[ "$DAY_FILTER" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "--day must be YYYY-MM-DD" >&2
  exit 2
fi

mapfile -t all_files < <(find "$SESSIONS_ROOT" -type f -name '*.jsonl' | sort)

if [ "${#all_files[@]}" -eq 0 ]; then
  echo "Total MCP calls: 0"
  echo "No session files found."
  exit 0
fi

files=()
if [ -n "$DAY_FILTER" ]; then
  day_path="${DAY_FILTER//-//}"
  for f in "${all_files[@]}"; do
    if [[ "$f" == *"/$day_path/"* ]]; then
      files+=("$f")
    fi
  done
else
  files=("${all_files[@]}")
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "Total MCP calls: 0"
  if [ -n "$DAY_FILTER" ]; then
    echo "No session files for day: $DAY_FILTER"
  else
    echo "No session files matched."
  fi
  exit 0
fi

tmp_calls="$(mktemp)"
trap 'rm -f "$tmp_calls"' EXIT

# Count only actual function call events with mcp__* tool names.
rg -No '"type":"function_call","name":"mcp__[A-Za-z0-9._-]+__[A-Za-z0-9._-]+"' "${files[@]}" \
  | sed -E 's/.*"name":"([^"]+)".*/\1/' >"$tmp_calls" || true

total_calls="$(wc -l <"$tmp_calls" | tr -d '[:space:]')"
echo "Total MCP calls: $total_calls"
if [ -n "$DAY_FILTER" ]; then
  echo "Day filter: $DAY_FILTER"
fi
echo "Sessions root: $SESSIONS_ROOT"

if [ "$total_calls" -eq 0 ]; then
  exit 0
fi

echo
echo "By server:"
awk -F'__' '{print $2}' "$tmp_calls" | sort | uniq -c | sort -nr

echo
echo "Top tools (max $TOP_N):"
sort "$tmp_calls" | uniq -c | sort -nr | head -n "$TOP_N"
