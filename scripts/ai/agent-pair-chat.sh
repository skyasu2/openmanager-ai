#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ai/agent-pair-chat.sh --topic "<message>" [options]

Options:
  --a <agent>             First agent: claude|codex|gemini
  --b <agent>             Second agent: claude|codex|gemini
  --all-pairs             Run all 3 pair combinations (claude-codex, claude-gemini, codex-gemini)
  --topic <text>          Initial message/topic (required)
  --turns <n>             Number of turns per pair (default: 4)
  --max-chars <n>         Max response length hint per turn (default: 700)
  --cwd <dir>             Working directory for CLI calls (default: current dir)
  --model-a <name>        Model override for agent A
  --model-b <name>        Model override for agent B
  --out <file>            Write transcript to file (default: logs/ai-chat/<timestamp>-<pair>.log)
  --dry-run               Print planned run without calling agents
  -h, --help              Show help

Examples:
  bash scripts/ai/agent-pair-chat.sh --a claude --b codex --topic "서버 캐시 전략 비교" --turns 6
  bash scripts/ai/agent-pair-chat.sh --all-pairs --topic "RAG 품질 개선 우선순위" --turns 3
EOF
}

is_agent() {
  case "$1" in
    claude|codex|gemini) return 0 ;;
    *) return 1 ;;
  esac
}

AGENT_A=""
AGENT_B=""
ALL_PAIRS=false
TOPIC=""
TURNS=4
MAX_CHARS=700
CWD="$(pwd)"
MODEL_A=""
MODEL_B=""
OUT_FILE=""
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --a)
      AGENT_A="${2:-}"
      shift 2
      ;;
    --b)
      AGENT_B="${2:-}"
      shift 2
      ;;
    --all-pairs)
      ALL_PAIRS=true
      shift
      ;;
    --topic)
      TOPIC="${2:-}"
      shift 2
      ;;
    --turns)
      TURNS="${2:-}"
      shift 2
      ;;
    --max-chars)
      MAX_CHARS="${2:-}"
      shift 2
      ;;
    --cwd)
      CWD="${2:-}"
      shift 2
      ;;
    --model-a)
      MODEL_A="${2:-}"
      shift 2
      ;;
    --model-b)
      MODEL_B="${2:-}"
      shift 2
      ;;
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "${TOPIC//[[:space:]]/}" ]; then
  echo "ERROR: --topic is required." >&2
  exit 2
fi

if ! [[ "$TURNS" =~ ^[0-9]+$ ]] || [ "$TURNS" -le 0 ]; then
  echo "ERROR: --turns must be a positive integer." >&2
  exit 2
fi

if ! [[ "$MAX_CHARS" =~ ^[0-9]+$ ]] || [ "$MAX_CHARS" -le 0 ]; then
  echo "ERROR: --max-chars must be a positive integer." >&2
  exit 2
fi

if [ ! -d "$CWD" ]; then
  echo "ERROR: --cwd does not exist: $CWD" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_SCRIPT="$SCRIPT_DIR/agent-bridge.sh"
if [ ! -x "$BRIDGE_SCRIPT" ]; then
  echo "ERROR: bridge script not executable: $BRIDGE_SCRIPT" >&2
  exit 2
fi

if [ "${AGENT_PAIR_CHAT_ACTIVE:-0}" = "1" ]; then
  echo "ERROR: recursive pair-chat call blocked." >&2
  exit 3
fi
export AGENT_PAIR_CHAT_ACTIVE=1

build_prompt() {
  local speaker="$1"
  local partner="$2"
  local turn="$3"
  local context="$4"

  cat <<EOF
당신은 1:1 에이전트 토론 참여자입니다.

규칙:
- 답변 언어: 한국어
- 길이: 최대 ${MAX_CHARS}자
- 포맷: 핵심만 간결하게, 불필요한 서론 금지
- 코드 블록/마크다운 헤더 금지
- 본인이 ${speaker}, 상대가 ${partner}라고 가정

현재 턴: ${turn}
상대의 직전 메시지:
${context}

요청:
상대 메시지에 이어지는 "다음 1개 답변"만 작성하세요.
EOF
}

run_turn() {
  local speaker="$1"
  local model="$2"
  local prompt="$3"

  local cmd=(bash "$BRIDGE_SCRIPT" --to "$speaker" --cwd "$CWD")
  if [ -n "$model" ]; then
    cmd+=(--model "$model")
  fi
  cmd+=("$prompt")

  "${cmd[@]}"
}

run_pair() {
  local a="$1"
  local b="$2"
  local model_a="$3"
  local model_b="$4"
  local out="$5"

  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  mkdir -p "$(dirname "$out")"
  {
    echo "=== Agent Pair Chat ==="
    echo "started_at=$timestamp"
    echo "pair=${a}<->${b}"
    echo "turns=$TURNS"
    echo "cwd=$CWD"
    echo "topic=$TOPIC"
    echo
  } >"$out"

  echo "=== ${a} <-> ${b} (${TURNS} turns) ==="

  local current="$TOPIC"
  local speaker partner model reply prompt

  for turn in $(seq 1 "$TURNS"); do
    if (( turn % 2 == 1 )); then
      speaker="$a"
      partner="$b"
      model="$model_a"
    else
      speaker="$b"
      partner="$a"
      model="$model_b"
    fi

    prompt="$(build_prompt "$speaker" "$partner" "$turn" "$current")"

    if [ "$DRY_RUN" = "true" ]; then
      reply="[dry-run] ${speaker} response"
    else
      reply="$(run_turn "$speaker" "$model" "$prompt")"
    fi

    echo "[$turn][$speaker] $reply"
    {
      echo "[$turn][$speaker]"
      echo "$reply"
      echo
    } >>"$out"

    current="$reply"
  done

  echo "saved: $out"
}

if [ "$ALL_PAIRS" = "true" ]; then
  base_dir="logs/ai-chat"
  ts="$(date '+%Y%m%d-%H%M%S')"
  run_pair "claude" "codex" "" "" "${base_dir}/${ts}-claude-codex.log"
  run_pair "claude" "gemini" "" "" "${base_dir}/${ts}-claude-gemini.log"
  run_pair "codex" "gemini" "" "" "${base_dir}/${ts}-codex-gemini.log"
  exit 0
fi

if ! is_agent "$AGENT_A" || ! is_agent "$AGENT_B"; then
  echo "ERROR: --a and --b are required (claude|codex|gemini)." >&2
  exit 2
fi

if [ "$AGENT_A" = "$AGENT_B" ]; then
  echo "ERROR: --a and --b must be different agents." >&2
  exit 2
fi

if [ -z "$OUT_FILE" ]; then
  ts="$(date '+%Y%m%d-%H%M%S')"
  OUT_FILE="logs/ai-chat/${ts}-${AGENT_A}-${AGENT_B}.log"
fi

run_pair "$AGENT_A" "$AGENT_B" "$MODEL_A" "$MODEL_B" "$OUT_FILE"
