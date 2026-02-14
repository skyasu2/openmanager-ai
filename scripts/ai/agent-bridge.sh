#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ai/agent-bridge.sh --to <claude|codex|gemini> [options] [prompt...]

Description:
  One-shot bridge to call Claude Code, Codex CLI, or Gemini CLI from the same WSL shell.
  Prevents recursive bridge loops by default.

Options:
  --to <target>           Required. claude | codex | gemini
  --cwd <dir>             Optional working directory (default: current dir)
  --model <name>          Optional model override for target CLI
  --timeout <seconds>     Optional timeout for target CLI (default: 120)
  --allow-recursion       Allow nested bridge calls (default: blocked)
  --dry-run               Print resolved settings without calling target
  --no-log                Disable logging to logs/ai-bridge/
  -h, --help              Show this help

Prompt input:
  1) Positional arguments are joined as one prompt.
  2) If no positional prompt, stdin is read.

Examples:
  bash scripts/ai/agent-bridge.sh --to claude "현재 브랜치 요약해줘"
  echo "type error 원인 찾아줘" | bash scripts/ai/agent-bridge.sh --to codex
  bash scripts/ai/agent-bridge.sh --to gemini --timeout 60 "분석해줘"
EOF
}

TARGET=""
CWD="$(pwd)"
MODEL=""
TIMEOUT=120
ALLOW_RECURSION=false
DRY_RUN=false
NO_LOG=false

is_dir_readable() {
  local dir="$1"
  ls -ld "$dir" >/dev/null 2>&1
}

has_gemini_api_key() {
  [ -n "${GEMINI_API_KEY:-}" ] || [ -n "${GOOGLE_API_KEY:-}" ] || [ -n "${GOOGLE_AI_API_KEY:-}" ]
}

has_gemini_oauth_cache() {
  [ -s "${HOME}/.gemini/oauth_creds.json" ]
}

while [ $# -gt 0 ]; do
  case "$1" in
    --to)
      TARGET="${2:-}"
      shift 2
      ;;
    --cwd)
      CWD="${2:-}"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:-120}"
      shift 2
      ;;
    --no-log)
      NO_LOG=true
      shift
      ;;
    --allow-recursion)
      ALLOW_RECURSION=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "ERROR: --to is required (claude|codex|gemini)." >&2
  usage >&2
  exit 2
fi

if [ "$TARGET" != "claude" ] && [ "$TARGET" != "codex" ] && [ "$TARGET" != "gemini" ]; then
  echo "ERROR: invalid --to target: $TARGET" >&2
  exit 2
fi

if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || [ "$TIMEOUT" -lt 1 ] || [ "$TIMEOUT" -gt 600 ]; then
  echo "ERROR: --timeout must be 1..600 (seconds). Got: $TIMEOUT" >&2
  exit 2
fi

if [ ! -d "$CWD" ]; then
  echo "ERROR: --cwd does not exist: $CWD" >&2
  exit 2
fi

if ! is_dir_readable "$CWD"; then
  echo "ERROR: --cwd is not readable from current WSL session: $CWD" >&2
  echo "HINT: If this is under /mnt/d and you see ENODEV, remount drvfs (or restart WSL)." >&2
  exit 2
fi

PROMPT=""
if [ $# -gt 0 ]; then
  PROMPT="$*"
else
  if [ -t 0 ]; then
    echo "ERROR: prompt is empty. Provide args or stdin." >&2
    exit 2
  fi
  PROMPT="$(cat)"
fi

if [ -z "${PROMPT//[[:space:]]/}" ]; then
  echo "ERROR: prompt is empty." >&2
  exit 2
fi

if [ "${AGENT_BRIDGE_ACTIVE:-0}" = "1" ] && [ "$ALLOW_RECURSION" != "true" ]; then
  echo "ERROR: recursive bridge call blocked. Use --allow-recursion to override." >&2
  exit 3
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "bridge_target=$TARGET"
  echo "bridge_cwd=$CWD"
  echo "bridge_model=${MODEL:-<default>}"
  echo "bridge_timeout=${TIMEOUT}s"
  echo "bridge_logging=$([ "$NO_LOG" = "true" ] && echo "disabled" || echo "enabled")"
  echo "prompt_chars=${#PROMPT}"
  exit 0
fi

export AGENT_BRIDGE_ACTIVE=1

# --- Logging ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/ai-bridge"

log_call() {
  if [ "$NO_LOG" = "true" ]; then return; fi
  mkdir -p "$LOG_DIR"
  local status="$1" duration="$2"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '%s\t%s\t%s\t%ss\tmodel=%s\tprompt_chars=%d\n' \
    "$ts" "$TARGET" "$status" "$duration" "${MODEL:-default}" "${#PROMPT}" \
    >> "$LOG_DIR/bridge.log"
}

# --- Timeout wrapper ---
run_with_timeout() {
  timeout "$TIMEOUT" "$@"
  local rc=$?
  if [ $rc -eq 124 ]; then
    echo "ERROR: $TARGET timed out after ${TIMEOUT}s." >&2
  fi
  return $rc
}
export -f run_with_timeout
export TIMEOUT TARGET

run_claude() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "ERROR: claude command not found." >&2
    exit 127
  fi

  local cmd=(claude -p)
  if [ -n "$MODEL" ]; then
    cmd+=(--model "$MODEL")
  fi
  cmd+=("$PROMPT")

  (
    cd "$CWD"
    run_with_timeout "${cmd[@]}"
  )
}

run_codex() {
  if ! command -v codex >/dev/null 2>&1; then
    echo "ERROR: codex command not found." >&2
    exit 127
  fi

  local out_file log_file
  out_file="$(mktemp)"
  log_file="$(mktemp)"
  trap 'rm -f "$out_file" "$log_file"' RETURN

  local cmd=(codex exec --output-last-message "$out_file" -C "$CWD")
  if [ -n "$MODEL" ]; then
    cmd+=(-m "$MODEL")
  fi
  cmd+=("$PROMPT")

  if ! run_with_timeout "${cmd[@]}" >"$log_file" 2>&1; then
    cat "$log_file" >&2
    if [ -s "$out_file" ]; then
      cat "$out_file"
    fi
    return 1
  fi

  if [ -s "$out_file" ]; then
    cat "$out_file"
    if [ "$(tail -c 1 "$out_file" 2>/dev/null || true)" != "" ]; then
      echo
    fi
    return 0
  fi

  cat "$log_file"
}

run_gemini() {
  if ! command -v gemini >/dev/null 2>&1; then
    echo "ERROR: gemini command not found." >&2
    exit 127
  fi

  if ! is_dir_readable "$CWD"; then
    echo "ERROR: gemini workspace is not readable: $CWD" >&2
    echo "HINT: Recover /mnt/* mount first (ENODEV)." >&2
    exit 2
  fi

  if ! has_gemini_api_key && ! has_gemini_oauth_cache; then
    echo "ERROR: Gemini authentication is not ready." >&2
    echo "HINT: Set GEMINI_API_KEY/GOOGLE_API_KEY or run interactive login once." >&2
    echo "      Example: NO_BROWSER=true gemini -p \"auth check\"" >&2
    exit 78
  fi

  if ! has_gemini_api_key && [ ! -t 1 ]; then
    echo "ERROR: Non-interactive Gemini bridge requires an API key." >&2
    echo "HINT: Export GEMINI_API_KEY (or GOOGLE_API_KEY / GOOGLE_AI_API_KEY)." >&2
    echo "      OAuth consent prompts cannot be completed without a TTY/browser flow." >&2
    exit 78
  fi

  if [ -z "${NO_BROWSER:-}" ]; then
    export NO_BROWSER=true
  fi

  local cmd=(gemini -p "$PROMPT" --output-format text)
  if [ -n "$MODEL" ]; then
    cmd=(gemini -p "$PROMPT" --output-format text --model "$MODEL")
  fi

  local log_file
  log_file="$(mktemp)"
  trap 'rm -f "$log_file"' RETURN

  if ! (
    cd "$CWD"
    run_with_timeout "${cmd[@]}" >"$log_file" 2>&1
  ); then
    cat "$log_file" >&2
    if grep -Eqi "Interactive consent could not be obtained|authorization code|FatalAuthenticationError" "$log_file"; then
      cat >&2 <<'EOF'
ERROR: Gemini OAuth flow requires one-time interactive consent in your current WSL session.
HINT: Run this once in the same shell:
      NO_BROWSER=true gemini -p "auth check"
EOF
    fi
    return 1
  fi

  cat "$log_file"
}

START_TIME="$(date +%s)"
EXIT_CODE=0

case "$TARGET" in
  claude)  run_claude  || EXIT_CODE=$? ;;
  codex)   run_codex   || EXIT_CODE=$? ;;
  gemini)  run_gemini  || EXIT_CODE=$? ;;
esac

ELAPSED=$(( $(date +%s) - START_TIME ))
if [ $EXIT_CODE -eq 0 ]; then
  log_call "ok" "$ELAPSED"
else
  log_call "fail:$EXIT_CODE" "$ELAPSED"
fi

exit $EXIT_CODE
