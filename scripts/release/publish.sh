#!/usr/bin/env bash
# scripts/release/publish.sh
# Full release pipeline: version bump → push → GitHub Release
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

# ── Preflight ──────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "❌ gh CLI가 설치되어 있지 않습니다." >&2
  exit 1
fi

if ! gh auth status &>/dev/null 2>&1; then
  echo "❌ gh 인증이 필요합니다: gh auth login" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요." >&2
  git status --short
  exit 1
fi

# ── Dry-run mode ───────────────────────────────────────────
if [[ -n "$DRY_RUN" ]]; then
  echo "🔍 Dry-run 모드"
  if [[ -n "$RELEASE_TYPE" ]]; then
    npx commit-and-tag-version --dry-run --release-as "$RELEASE_TYPE"
  else
    npx commit-and-tag-version --dry-run
  fi
  exit 0
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

# ── 3. Push commit + tag ──────────────────────────────────
echo "🚀 Push 중... (commit + tag)"
git push --follow-tags origin main

# ── 4. GitHub Release ─────────────────────────────────────
echo "📋 GitHub Release 생성 중..."
gh release create "$TAG" --generate-notes --title "$TAG"

RELEASE_URL=$(gh release view "$TAG" --json url -q '.url')
echo ""
echo "═══════════════════════════════════════════"
echo "✅ 릴리스 완료: ${TAG}"
echo "📋 ${RELEASE_URL}"
echo "═══════════════════════════════════════════"
