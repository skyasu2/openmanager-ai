#!/usr/bin/env bash
# Mirror repo-local .agents/skills/ → ~/.codex/skills/
# Codex 공개 문서 기준 repo-local .agents/skills/ discovery는 별도로 지원된다.
# 이 스크립트는 user-scope ~/.codex/skills/ mirror를 유지하려는 경우에만 사용한다.
set -euo pipefail

AGENTS_SKILLS="$(cd "$(dirname "$0")/../.." && pwd)/.agents/skills"
CODEX_SKILLS="$HOME/.codex/skills"
MANAGED_SKILLS_FILE="$CODEX_SKILLS/.openmanager-managed-skills"

if [ ! -d "$AGENTS_SKILLS" ]; then
  echo "ERROR: .agents/skills/ not found at $AGENTS_SKILLS" >&2
  exit 1
fi

mkdir -p "$CODEX_SKILLS"

declare -a current_skills=()
while IFS= read -r -d '' skill_dir; do
  skill_name="$(basename "$skill_dir")"
  dest="$CODEX_SKILLS/$skill_name"
  rsync -a --delete "$skill_dir"/ "$dest"/
  current_skills+=("$skill_name")
done < <(find "$AGENTS_SKILLS" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

if [ -f "$MANAGED_SKILLS_FILE" ]; then
  while IFS= read -r old_skill || [ -n "$old_skill" ]; do
    [ -n "$old_skill" ] || continue
    if [[ ! " ${current_skills[*]} " =~ [[:space:]]${old_skill}[[:space:]] ]]; then
      rm -rf "$CODEX_SKILLS/$old_skill"
      echo "  removed stale mirror: $old_skill"
    fi
  done < "$MANAGED_SKILLS_FILE"
fi

printf '%s\n' "${current_skills[@]}" > "$MANAGED_SKILLS_FILE"

synced=${#current_skills[@]}

echo "Done: $synced skills → $CODEX_SKILLS (repo-managed skills only)"
