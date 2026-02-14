#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ai/agent-bridge.sh --to <claude|codex|gemini> [options] [prompt...]

Description:
  One-shot bridge to call Claude Code or Codex CLI from the same WSL shell.
  Prevents recursive bridge loops by default.

Options:
  --to <target>           Required. claude | codex | gemini
  --cwd <dir>             Optional working directory (default: current dir)
  --model <name>          Optional model override for target CLI
  --allow-recursion       Allow nested bridge calls (default: blocked)
  --dry-run               Print resolved settings without calling target
  -h, --help              Show this help

Prompt input:
  1) Positional arguments are joined as one prompt.
  2) If no positional prompt, stdin is read.

Examples:
  bash scripts/ai/agent-bridge.sh --to claude "현재 브랜치 요약해줘"
  echo "type error 원인 찾아줘" | bash scripts/ai/agent-bridge.sh --to codex
EOF
}

TARGET=""
CWD="$(pwd)"
MODEL=""
ALLOW_RECURSION=false
DRY_RUN=false

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

if [ ! -d "$CWD" ]; then
  echo "ERROR: --cwd does not exist: $CWD" >&2
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
  echo "prompt_chars=${#PROMPT}"
  exit 0
fi

export AGENT_BRIDGE_ACTIVE=1

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
    "${cmd[@]}"
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

  if ! "${cmd[@]}" >"$log_file" 2>&1; then
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

  local cmd=(gemini -p "$PROMPT" --output-format text)
  if [ -n "$MODEL" ]; then
    cmd=(gemini -p "$PROMPT" --output-format text --model "$MODEL")
  fi

  (
    cd "$CWD"
    "${cmd[@]}"
  )
}

case "$TARGET" in
  claude)
    run_claude
    ;;
  codex)
    run_codex
    ;;
  gemini)
    run_gemini
    ;;
esac
