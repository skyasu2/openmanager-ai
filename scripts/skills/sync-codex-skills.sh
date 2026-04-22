#!/usr/bin/env bash
# Sync .agents/skills/ → ~/.codex/skills/
# Run after adding or updating any skill in .agents/skills/
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
