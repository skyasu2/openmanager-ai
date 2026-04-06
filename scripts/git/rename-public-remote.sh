#!/usr/bin/env bash
set -euo pipefail

PREFERRED_REMOTE="${1:-github-public}"
LEGACY_REMOTE="${2:-origin}"

if git remote get-url "$PREFERRED_REMOTE" >/dev/null 2>&1; then
  echo "✅ GitHub public remote already uses '$PREFERRED_REMOTE'"
  exit 0
fi

if ! git remote get-url "$LEGACY_REMOTE" >/dev/null 2>&1; then
  echo "❌ legacy remote '$LEGACY_REMOTE' not found" >&2
  exit 1
fi

legacy_url="$(git remote get-url "$LEGACY_REMOTE")"
if [[ "$legacy_url" != *"github.com"* ]]; then
  echo "❌ '$LEGACY_REMOTE' does not point to github.com: $legacy_url" >&2
  exit 1
fi

git remote rename "$LEGACY_REMOTE" "$PREFERRED_REMOTE"

if git show-ref --verify --quiet "refs/remotes/$PREFERRED_REMOTE/main"; then
  git remote set-head "$PREFERRED_REMOTE" main >/dev/null 2>&1 || true
fi

echo "✅ Renamed GitHub public remote: $LEGACY_REMOTE -> $PREFERRED_REMOTE"
echo "ℹ️  Canonical remote remains: gitlab"
