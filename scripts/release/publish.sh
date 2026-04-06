#!/usr/bin/env bash
# scripts/release/publish.sh
# Canonical release pipeline: version bump -> consistency check -> push commit/tag to GitLab
#
# Usage:
#   ./scripts/release/publish.sh           # auto (commit-and-tag-version decides)
#   ./scripts/release/publish.sh patch     # force patch
#   ./scripts/release/publish.sh minor     # force minor
#   ./scripts/release/publish.sh major     # force major
#   DRY_RUN=1 ./scripts/release/publish.sh # preview only

set -euo pipefail

RELEASE_TYPE="${1:-}"
DRY_RUN="${DRY_RUN:-}"
CANONICAL_REMOTE="${CANONICAL_REMOTE:-gitlab}"

# ── Dry-run mode ───────────────────────────────────────────
if [[ -n "$DRY_RUN" ]]; then
  echo "🔍 Dry-run 모드"
  if [[ -n "$RELEASE_TYPE" ]]; then
    npx commit-and-tag-version --dry-run --release-as "$RELEASE_TYPE"
  else
    npx commit-and-tag-version --dry-run
  fi
  echo ""
  echo "ℹ️  Dry-run output may mention origin because commit-and-tag-version prints its default hint."
  echo "   Actual canonical publish path in this repository is: git push --follow-tags ${CANONICAL_REMOTE} main"
  exit 0
fi

# ── Preflight ──────────────────────────────────────────────
if ! git remote get-url "$CANONICAL_REMOTE" >/dev/null 2>&1; then
  echo "❌ Canonical remote '$CANONICAL_REMOTE'가 없습니다." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요." >&2
  git status --short
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
UPSTREAM_BRANCH="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
PUSH_DEFAULT="$(git config --get remote.pushDefault 2>/dev/null || true)"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "❌ 릴리즈는 main 브랜치에서만 허용됩니다. (current: ${CURRENT_BRANCH:-unknown})" >&2
  exit 1
fi

if [[ "$UPSTREAM_BRANCH" != "${CANONICAL_REMOTE}/main" ]]; then
  echo "❌ main upstream이 ${CANONICAL_REMOTE}/main 이어야 합니다. (current: ${UPSTREAM_BRANCH:-none})" >&2
  echo "   Fix: git branch --set-upstream-to=${CANONICAL_REMOTE}/main main" >&2
  exit 1
fi

if [[ "$PUSH_DEFAULT" != "$CANONICAL_REMOTE" ]]; then
  echo "❌ remote.pushDefault가 ${CANONICAL_REMOTE} 이어야 합니다. (current: ${PUSH_DEFAULT:-none})" >&2
  exit 1
fi

# ── 1. Version bump + CHANGELOG + tag ─────────────────────
echo "📦 릴리스 생성 중..."
if [[ -n "$RELEASE_TYPE" ]]; then
  npx commit-and-tag-version --release-as "$RELEASE_TYPE"
else
  npx commit-and-tag-version
fi

# Extract the new version from package.json
NEW_VERSION=$(node -p "require('./package.json').version")
TAG="v${NEW_VERSION}"
echo "✅ ${TAG} 태그 생성 완료"

# ── 2. Consistency check ──────────────────────────────────
echo "🔍 릴리스 일관성 점검..."
node scripts/release/check-release-consistency.js

# ── 3. Push commit + tag to canonical GitLab ──────────────
echo "🚀 Canonical push 중... (commit + tag -> ${CANONICAL_REMOTE}/main)"
git push --follow-tags "$CANONICAL_REMOTE" main

echo ""
echo "═══════════════════════════════════════════"
echo "✅ 릴리스 완료: ${TAG}"
echo "📦 canonical remote: ${CANONICAL_REMOTE}"
echo "ℹ️  public snapshot은 별도 경로입니다: npm run sync:github"
echo "═══════════════════════════════════════════"
