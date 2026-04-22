#!/usr/bin/env bash
# Mirror repo-local .agents/skills/ → ~/.codex/skills/
# Codex 공개 문서 기준 repo-local .agents/skills/ discovery는 별도로 지원된다.
# 이 스크립트는 user-scope ~/.codex/skills/ mirror를 유지하려는 경우에만 사용한다.
set -euo pipefail

AGENTS_SKILLS="$(cd "$(dirname "$0")/../.." && pwd)/.agents/skills"
CODEX_SKILLS="$HOME/.codex/skills"

if [ ! -d "$AGENTS_SKILLS" ]; then
  echo "ERROR: .agents/skills/ not found at $AGENTS_SKILLS" >&2
  exit 1
fi

mkdir -p "$CODEX_SKILLS"

synced=0
for skill_dir in "$AGENTS_SKILLS"/*/; do
  skill_name=$(basename "$skill_dir")
  dest="$CODEX_SKILLS/$skill_name"
  rsync -a --delete "$skill_dir" "$dest/"
  echo "  synced: $skill_name"
  synced=$((synced + 1))
done

echo "Done: $synced skills → $CODEX_SKILLS"
