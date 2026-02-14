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
  --mode <type>           query | analysis | doc (default: query)
  --timeout <seconds>     Optional timeout for target CLI (default: 120)
  --save <path>           Save markdown record to a file
  --save-auto             Save markdown record under logs/ai-bridge/notes/
  --redact                Redact common secrets when saving markdown
  --title <text>          Markdown title when saving (default: AI Bridge Result)
  --claude-fast           Run Claude from /tmp for faster startup (default)
  --claude-full           Run Claude from --cwd with full project context
  --gemini-yolo           Pass --yolo to Gemini CLI (opt-in only)
  --no-self               Block self-target calls (e.g., codex -> codex)
  --from <agent>          Explicit source agent: claude | codex | gemini
  --allow-external-save   Allow --save path outside project root
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
MODE="query"
TIMEOUT=120
SAVE_PATH=""
SAVE_AUTO=false
REDACT=false
DOC_TITLE="AI Bridge Result"
CLAUDE_FAST=true
GEMINI_YOLO=false
NO_SELF=false
FROM_AGENT=""
ALLOW_EXTERNAL_SAVE=false
ALLOW_RECURSION=false
DRY_RUN=false
NO_LOG=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/ai-bridge"

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

resolve_path() {
  local input_path="$1"
  if [ -z "$input_path" ]; then
    return 1
  fi
  if [[ "$input_path" = /* ]]; then
    realpath -m "$input_path"
  else
    realpath -m "$CWD/$input_path"
  fi
}

is_under_project_root() {
  local target="$1"
  local root
  root="$(realpath -m "$PROJECT_ROOT")"
  [[ "$target" == "$root" || "$target" == "$root/"* ]]
}

redact_text() {
  sed -E \
    -e 's/(GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_AI_API_KEY|SUPABASE_ACCESS_TOKEN|VERCEL_API_KEY|GITHUB_PERSONAL_ACCESS_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)=([^[:space:]]+)/\1=<redacted>/g' \
    -e 's/\b(sk-[A-Za-z0-9_-]{16,})\b/<redacted-openai-key>/g' \
    -e 's/\b(gh[opusr]_[A-Za-z0-9]{16,})\b/<redacted-github-token>/g' \
    -e 's/\b(AIza[0-9A-Za-z_-]{16,})\b/<redacted-google-key>/g'
}

detect_agent_from_process_tree() {
  local pid cmd ppid i
  pid="$$"
  for i in 1 2 3 4 5 6 7 8; do
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    if [ -z "$ppid" ] || [ "$ppid" -le 1 ] 2>/dev/null; then
      break
    fi
    cmd="$(ps -o args= -p "$ppid" 2>/dev/null || true)"
    case "$cmd" in
      *claude*) echo "claude"; return 0 ;;
      *codex*) echo "codex"; return 0 ;;
      *gemini*) echo "gemini"; return 0 ;;
    esac
    pid="$ppid"
  done
  return 1
}

resolve_source_agent() {
  if [ -n "$FROM_AGENT" ]; then
    printf '%s' "$FROM_AGENT"
    return 0
  fi
  if [ -n "${OPENMANAGER_AGENT_NAME:-}" ]; then
    printf '%s' "$OPENMANAGER_AGENT_NAME"
    return 0
  fi
  if [ -n "${CLAUDECODE:-}" ]; then
    printf 'claude'
    return 0
  fi
  detect_agent_from_process_tree
}

build_mode_prefix() {
  case "$MODE" in
    query)
      printf ''
      ;;
    analysis)
      cat <<'EOF'
[모드: 분석]
- 한국어로만 답변하세요.
- 요청사항을 분석하고, 근거/가정/결론을 명확히 분리하세요.
- 코드 변경 지시나 시스템 명령 실행은 제안만 하고 직접 실행했다고 말하지 마세요.
EOF
      ;;
    doc)
      cat <<'EOF'
[모드: 문서화]
- 한국어로만 답변하세요.
- 바로 문서에 붙여넣을 수 있는 Markdown으로 작성하세요.
- 섹션 순서: 요약 / 상세 분석 / 결정사항 / 후속 액션.
- 코드 변경이나 명령 실행 여부는 추측하지 말고 답변 내용만 문서화하세요.
EOF
      ;;
  esac
}

write_markdown_record() {
  local out_file="$1" status="$2"
  local save_file="$SAVE_PATH"
  local now_utc now_ts mode_label
  local prompt_content response_content
  now_utc="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  now_ts="$(date -u '+%Y%m%dT%H%M%SZ')"
  mode_label="${MODE// /-}"

  if [ "$SAVE_AUTO" = "true" ] && [ -z "$save_file" ]; then
    save_file="$LOG_DIR/notes/${now_ts}-${TARGET}-${mode_label}.md"
  fi

  if [ -z "$save_file" ]; then
    return 0
  fi

  if [ "$REDACT" = "true" ]; then
    prompt_content="$(printf '%s' "$PROMPT" | redact_text)"
    response_content="$(cat "$out_file" | redact_text)"
  else
    prompt_content="$PROMPT"
    response_content="$(cat "$out_file")"
  fi

  mkdir -p "$(dirname "$save_file")"

  cat >"$save_file" <<EOF
# ${DOC_TITLE}

- timestamp: ${now_utc}
- target: ${TARGET}
- mode: ${MODE}
- status: ${status}
- cwd: ${CWD}
- model: ${MODEL:-default}

## Prompt

\`\`\`text
${prompt_content}
\`\`\`

## Response

\`\`\`text
${response_content}
\`\`\`
EOF

  echo "saved_markdown=${save_file}" >&2
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
    --mode)
      MODE="${2:-query}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:-120}"
      shift 2
      ;;
    --save)
      SAVE_PATH="${2:-}"
      shift 2
      ;;
    --save-auto)
      SAVE_AUTO=true
      shift
      ;;
    --redact)
      REDACT=true
      shift
      ;;
    --title)
      DOC_TITLE="${2:-AI Bridge Result}"
      shift 2
      ;;
    --claude-fast)
      CLAUDE_FAST=true
      shift
      ;;
    --claude-full)
      CLAUDE_FAST=false
      shift
      ;;
    --gemini-yolo)
      GEMINI_YOLO=true
      shift
      ;;
    --no-self)
      NO_SELF=true
      shift
      ;;
    --from)
      FROM_AGENT="${2:-}"
      shift 2
      ;;
    --allow-external-save)
      ALLOW_EXTERNAL_SAVE=true
      shift
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

if [ -n "$FROM_AGENT" ] && [ "$FROM_AGENT" != "claude" ] && [ "$FROM_AGENT" != "codex" ] && [ "$FROM_AGENT" != "gemini" ]; then
  echo "ERROR: invalid --from: $FROM_AGENT (allowed: claude|codex|gemini)" >&2
  exit 2
fi

if [ "$MODE" != "query" ] && [ "$MODE" != "analysis" ] && [ "$MODE" != "doc" ]; then
  echo "ERROR: invalid --mode: $MODE (allowed: query|analysis|doc)" >&2
  exit 2
fi

if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || [ "$TIMEOUT" -lt 1 ] || [ "$TIMEOUT" -gt 600 ]; then
  echo "ERROR: --timeout must be 1..600 (seconds). Got: $TIMEOUT" >&2
  exit 2
fi

if [ -n "$SAVE_PATH" ] && [ "$SAVE_AUTO" = "true" ]; then
  echo "ERROR: --save and --save-auto cannot be used together." >&2
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

if [ -n "$SAVE_PATH" ]; then
  RESOLVED_SAVE_PATH="$(resolve_path "$SAVE_PATH")"
  if [ -z "$RESOLVED_SAVE_PATH" ]; then
    echo "ERROR: failed to resolve --save path: $SAVE_PATH" >&2
    exit 2
  fi
  if [ "$ALLOW_EXTERNAL_SAVE" != "true" ] && ! is_under_project_root "$RESOLVED_SAVE_PATH"; then
    echo "ERROR: --save path must be under project root by default." >&2
    echo "HINT: use --allow-external-save to override." >&2
    echo "      project_root=$PROJECT_ROOT" >&2
    echo "      requested=$RESOLVED_SAVE_PATH" >&2
    exit 2
  fi
  SAVE_PATH="$RESOLVED_SAVE_PATH"
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

if [ "$NO_SELF" = "true" ]; then
  SOURCE_AGENT="$(resolve_source_agent || true)"
  if [ -z "$SOURCE_AGENT" ]; then
    echo "ERROR: --no-self enabled but source agent could not be detected." >&2
    echo "HINT: pass --from <claude|codex|gemini> or set OPENMANAGER_AGENT_NAME." >&2
    exit 2
  fi
  if [ "$SOURCE_AGENT" = "$TARGET" ]; then
    echo "ERROR: self-target call blocked by --no-self (source=$SOURCE_AGENT target=$TARGET)." >&2
    exit 4
  fi
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "bridge_target=$TARGET"
  echo "bridge_cwd=$CWD"
  echo "bridge_model=${MODEL:-<default>}"
  echo "bridge_mode=$MODE"
  echo "bridge_timeout=${TIMEOUT}s"
  echo "bridge_save_path=${SAVE_PATH:-<none>}"
  echo "bridge_save_auto=$SAVE_AUTO"
  echo "bridge_redact=$REDACT"
  echo "bridge_claude_fast=$CLAUDE_FAST"
  echo "bridge_gemini_yolo=$GEMINI_YOLO"
  echo "bridge_no_self=$NO_SELF"
  echo "bridge_from=${FROM_AGENT:-<auto>}"
  echo "bridge_allow_external_save=$ALLOW_EXTERNAL_SAVE"
  echo "bridge_logging=$([ "$NO_LOG" = "true" ] && echo "disabled" || echo "enabled")"
  echo "prompt_chars=${#PROMPT}"
  exit 0
fi

export AGENT_BRIDGE_ACTIVE=1

MODE_PREFIX="$(build_mode_prefix)"
if [ -n "$MODE_PREFIX" ]; then
  PROMPT="${MODE_PREFIX}

[요청]
${PROMPT}"
fi

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
  local rc=0
  timeout "$TIMEOUT" "$@" || rc=$?
  if [ $rc -eq 124 ]; then
    echo "ERROR: $TARGET timed out after ${TIMEOUT}s." >&2
  fi
  return $rc
}

run_claude() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "ERROR: claude command not found." >&2
    return 127
  fi

  local cmd=(claude -p --no-session-persistence --max-turns 1)
  if [ -n "$MODEL" ]; then
    cmd+=(--model "$MODEL")
  fi
  cmd+=("$PROMPT")

  if [ "$CLAUDE_FAST" = "true" ]; then
    (
      cd /tmp
      unset CLAUDECODE
      run_with_timeout "${cmd[@]}"
    )
  else
    (
      cd "$CWD"
      run_with_timeout "${cmd[@]}"
    )
  fi
}

run_codex() {
  if ! command -v codex >/dev/null 2>&1; then
    echo "ERROR: codex command not found." >&2
    return 127
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
    return 127
  fi

  if ! is_dir_readable "$CWD"; then
    echo "ERROR: gemini workspace is not readable: $CWD" >&2
    echo "HINT: Recover /mnt/* mount first (ENODEV)." >&2
    return 2
  fi

  if ! has_gemini_api_key && ! has_gemini_oauth_cache; then
    echo "ERROR: Gemini authentication is not ready." >&2
    echo "HINT: Set GEMINI_API_KEY/GOOGLE_API_KEY or run interactive login once:" >&2
    echo "      gemini  (login via browser, then Ctrl+C)" >&2
    return 78
  fi

  if [ -z "${NO_BROWSER:-}" ]; then
    export NO_BROWSER=true
  fi

  local cmd=(gemini -p "$PROMPT" --output-format text)
  if [ "$GEMINI_YOLO" = "true" ]; then
    cmd=(gemini --yolo -p "$PROMPT" --output-format text)
  fi
  if [ -n "$MODEL" ]; then
    cmd+=("--model" "$MODEL")
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
OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT

set +e
case "$TARGET" in
  claude)  run_claude >"$OUTPUT_FILE" || EXIT_CODE=$? ;;
  codex)   run_codex  >"$OUTPUT_FILE" || EXIT_CODE=$? ;;
  gemini)  run_gemini >"$OUTPUT_FILE" || EXIT_CODE=$? ;;
esac
set -e

cat "$OUTPUT_FILE"

ELAPSED=$(( $(date +%s) - START_TIME ))
if [ $EXIT_CODE -eq 0 ]; then
  log_call "ok" "$ELAPSED"
else
  log_call "fail:$EXIT_CODE" "$ELAPSED"
fi

if [ "$SAVE_AUTO" = "true" ] || [ -n "$SAVE_PATH" ]; then
  write_markdown_record "$OUTPUT_FILE" "$([ $EXIT_CODE -eq 0 ] && echo "ok" || echo "fail:$EXIT_CODE")"
fi

exit $EXIT_CODE
