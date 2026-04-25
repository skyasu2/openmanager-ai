#!/usr/bin/env bash
# Codex uses repo-local .agents/skills/ as the OpenManager skill source.
# This command intentionally does not mirror into ~/.codex/skills.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
AGENTS_SKILLS="$PROJECT_DIR/.agents/skills"

if [ ! -d "$AGENTS_SKILLS" ]; then
  echo "ERROR: .agents/skills/ not found at $AGENTS_SKILLS" >&2
  exit 1
fi

echo "Codex OpenManager skills are project-scoped under: $AGENTS_SKILLS"
echo "No sync is required. Run this cleanup/check path if user-scope copies exist:"
echo "  bash scripts/ai/setup-codex-project-scope.sh"
echo "  npm run skills:check"
