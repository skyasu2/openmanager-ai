#!/usr/bin/env bash
# scripts/release/publish.sh
# Canonical release pipeline: version bump -> consistency check -> push commit/tag to GitLab
#
# Usage:
#   ./scripts/release/publish.sh           # auto (conventional commit bump)
#   ./scripts/release/publish.sh patch     # force patch
#   ./scripts/release/publish.sh minor     # force minor
#   ./scripts/release/publish.sh major     # force major
#   RELEASE_VERIFY_PRODUCTION=false ./scripts/release/publish.sh patch
#   RELEASE_VERIFY_RETRIES=80 RELEASE_VERIFY_DELAY_MS=15000 ./scripts/release/publish.sh patch
#   RELEASE_WAIT_FOR_GITLAB_PIPELINE=false ./scripts/release/publish.sh patch
#   DRY_RUN=1 ./scripts/release/publish.sh # preview only

set -euo pipefail

RELEASE_TYPE="${1:-}"
DRY_RUN="${DRY_RUN:-}"
CANONICAL_REMOTE="${CANONICAL_REMOTE:-gitlab}"
RELEASE_REQUIRE_DEPLOYED_BASE="${RELEASE_REQUIRE_DEPLOYED_BASE:-true}"
RELEASE_VERIFY_PRODUCTION="${RELEASE_VERIFY_PRODUCTION:-true}"
RELEASE_VERIFY_URL="${RELEASE_VERIFY_URL:-https://openmanager-ai.vercel.app}"
RELEASE_VERIFY_RETRIES="${RELEASE_VERIFY_RETRIES:-80}"
RELEASE_VERIFY_DELAY_MS="${RELEASE_VERIFY_DELAY_MS:-15000}"
RELEASE_VERIFY_TIMEOUT_MS="${RELEASE_VERIFY_TIMEOUT_MS:-8000}"
RELEASE_WAIT_FOR_GITLAB_PIPELINE="${RELEASE_WAIT_FOR_GITLAB_PIPELINE:-true}"
RELEASE_GITLAB_PIPELINE_WAIT_ATTEMPTS="${RELEASE_GITLAB_PIPELINE_WAIT_ATTEMPTS:-80}"
RELEASE_GITLAB_PIPELINE_WAIT_INTERVAL_SECONDS="${RELEASE_GITLAB_PIPELINE_WAIT_INTERVAL_SECONDS:-15}"
RELEASE_GITLAB_PIPELINE_MAX_NOT_FOUND_ATTEMPTS="${RELEASE_GITLAB_PIPELINE_MAX_NOT_FOUND_ATTEMPTS:-12}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_TOOL="${RELEASE_TOOL:-${SCRIPT_DIR}/version-and-tag.mjs}"

verification_window_minutes() {
  node -p "((Number(process.argv[1]) * Number(process.argv[2])) / 60000).toFixed(1)" \
    "$RELEASE_VERIFY_RETRIES" \
    "$RELEASE_VERIFY_DELAY_MS"
}

require_current_release_deployed() {
  local version="$1"
  local gate_enabled
  gate_enabled="$(printf '%s' "$RELEASE_REQUIRE_DEPLOYED_BASE" | tr '[:upper:]' '[:lower:]')"

  if [[ "$gate_enabled" == "false" || "$gate_enabled" == "0" || "$gate_enabled" == "off" ]]; then
    echo "⚪ Base release drift gate skipped (RELEASE_REQUIRE_DEPLOYED_BASE=${RELEASE_REQUIRE_DEPLOYED_BASE})"
    return 0
  fi

  if [[ ! -f "scripts/test/vercel-post-deploy-smoke.mjs" ]]; then
    echo "⚪ Base release drift gate skipped (missing scripts/test/vercel-post-deploy-smoke.mjs)"
    return 0
  fi

  echo "🔒 Current production version gate... (${RELEASE_VERIFY_URL}, expected=${version})"
  if node scripts/test/vercel-post-deploy-smoke.mjs \
    --url="${RELEASE_VERIFY_URL}" \
    --expected-version="${version}" \
    --timeout-ms="${RELEASE_VERIFY_TIMEOUT_MS}" \
    --retries=0 \
    --retry-delay-ms=0; then
    echo "✅ Current production already serves ${version}"
    return 0
  fi

  echo "❌ Refusing to create a new release while production drift remains."
  echo "   Expected current production version: ${version}"
  echo "   Fix the previous tag deploy first, or override once with:"
  echo "   RELEASE_REQUIRE_DEPLOYED_BASE=false ./scripts/release/publish.sh ${RELEASE_TYPE:-patch}"
  return 1
}

run_post_release_verification() {
  local version="$1"
  local tag="$2"
  local verify_enabled
  verify_enabled="$(printf '%s' "$RELEASE_VERIFY_PRODUCTION" | tr '[:upper:]' '[:lower:]')"

  if [[ "$verify_enabled" == "false" || "$verify_enabled" == "0" || "$verify_enabled" == "off" ]]; then
    echo "⚪ Production verification skipped (RELEASE_VERIFY_PRODUCTION=${RELEASE_VERIFY_PRODUCTION})"
    return 0
  fi

  if [[ ! -f "scripts/test/vercel-post-deploy-smoke.mjs" ]]; then
    echo "⚪ Production verification skipped (missing scripts/test/vercel-post-deploy-smoke.mjs)"
    return 0
  fi

  echo "🌐 Production 배포 검증 중... (${RELEASE_VERIFY_URL}, expected=${version})"
  echo "   verification window: ~$(verification_window_minutes)m (${RELEASE_VERIFY_RETRIES} x ${RELEASE_VERIFY_DELAY_MS}ms)"
  if node scripts/test/vercel-post-deploy-smoke.mjs \
    --url="${RELEASE_VERIFY_URL}" \
    --expected-version="${version}" \
    --timeout-ms="${RELEASE_VERIFY_TIMEOUT_MS}" \
    --retries="${RELEASE_VERIFY_RETRIES}" \
    --retry-delay-ms="${RELEASE_VERIFY_DELAY_MS}"; then
    echo "✅ Production version verification passed for ${tag}"
    return 0
  fi

  echo "❌ Production verification failed for ${tag}."
  echo "   Canonical commit/tag push는 완료됐지만, production version mismatch 또는 deploy failure가 남아 있습니다."
  echo "   Next: inspect the GitLab tag pipeline trace and the Vercel production deploy."
  echo "   If the tag pipeline is simply slower than the local verification window, rerun with:"
  echo "   RELEASE_VERIFY_RETRIES=120 RELEASE_VERIFY_DELAY_MS=15000 ./scripts/release/publish.sh ${RELEASE_TYPE:-patch}"
  echo "   First check whether the semver tag pattern is protected in GitLab so protected CI variables"
  echo "   (for example VERCEL_TOKEN, GCP_SERVICE_KEY, GCP_PROJECT_ID) are exposed on tag pipelines."
  echo "   If the tag pipeline already exists, fix the settings and retry that failed GitLab job/pipeline."
  echo "   Re-pushing the same existing remote tag will not create a new deploy pipeline."
  return 1
}

wait_for_gitlab_release_pipeline() {
  local wait_enabled
  wait_enabled="$(printf '%s' "$RELEASE_WAIT_FOR_GITLAB_PIPELINE" | tr '[:upper:]' '[:lower:]')"

  if [[ "$wait_enabled" == "false" || "$wait_enabled" == "0" || "$wait_enabled" == "off" ]]; then
    echo "⚪ GitLab tag pipeline wait skipped (RELEASE_WAIT_FOR_GITLAB_PIPELINE=${RELEASE_WAIT_FOR_GITLAB_PIPELINE})"
    return 0
  fi

  if [[ ! -f "scripts/gitlab/check-head-pipeline.sh" ]]; then
    echo "⚪ GitLab tag pipeline wait skipped (missing scripts/gitlab/check-head-pipeline.sh)"
    return 0
  fi

  echo "⏳ GitLab release pipeline 확인 중..."
  echo "   production smoke는 tag deploy/smoke pipeline이 끝난 뒤 실행합니다."

  local output=""
  local status=0
  set +e
  output="$(bash scripts/gitlab/check-head-pipeline.sh \
    --wait \
    --interval "$RELEASE_GITLAB_PIPELINE_WAIT_INTERVAL_SECONDS" \
    --attempts "$RELEASE_GITLAB_PIPELINE_WAIT_ATTEMPTS" \
    --max-not-found "$RELEASE_GITLAB_PIPELINE_MAX_NOT_FOUND_ATTEMPTS" 2>&1)"
  status=$?
  set -e

  printf '%s\n' "$output"

  if [[ "$status" -eq 0 ]]; then
    if grep -q 'status=success' <<<"$output"; then
      echo "✅ GitLab release pipeline success"
      return 0
    fi

    if grep -q 'note=pipeline_not_terminal_after_wait' <<<"$output"; then
      echo "❌ GitLab release pipeline did not finish within the configured wait window."
      echo "   Production polling is skipped because deploy authority is the GitLab tag pipeline."
      return 2
    fi

    if grep -q 'status=not_created' <<<"$output"; then
      echo "❌ GitLab release pipeline was not created for this SHA."
      echo "   Production polling is skipped because no canonical deploy pipeline is available."
      return 2
    fi

    echo "❌ GitLab release pipeline finished without success."
    echo "   Production polling is skipped because deploy authority is the GitLab tag pipeline."
    return 2
  fi

  if grep -qi 'GitLab token not found' <<<"$output"; then
    echo "⚠️ GitLab pipeline wait skipped because no GitLab token is available."
    echo "   Continuing with production version verification."
    return 0
  fi

  echo "❌ GitLab release pipeline failed or reached a terminal non-success state."
  echo "   Production polling is skipped because deploy authority is the GitLab tag pipeline."
  return "$status"
}

# ── Dry-run mode ───────────────────────────────────────────
if [[ -n "$DRY_RUN" ]]; then
  echo "🔍 Dry-run 모드"
  if [[ -n "$RELEASE_TYPE" ]]; then
    node "$RELEASE_TOOL" --dry-run --release-as "$RELEASE_TYPE"
  else
    node "$RELEASE_TOOL" --dry-run
  fi
  echo ""
  echo "ℹ️  Actual canonical publish path in this repository is: git push --follow-tags ${CANONICAL_REMOTE} main"
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

if [[ -f "scripts/gitlab/check-main-protection.mjs" ]]; then
  echo "🔐 GitLab deploy readiness check..."
  node scripts/gitlab/check-main-protection.mjs
fi

CURRENT_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || true)"
if [[ -n "$CURRENT_VERSION" ]]; then
  require_current_release_deployed "$CURRENT_VERSION"
fi

# ── 1. Version bump + CHANGELOG + tag ─────────────────────
echo "📦 릴리스 생성 중..."
if [[ -n "$RELEASE_TYPE" ]]; then
  node "$RELEASE_TOOL" --release-as "$RELEASE_TYPE"
else
  node "$RELEASE_TOOL"
fi

# Extract the new version from package.json
NEW_VERSION=$(node -p "require('./package.json').version")
TAG="v${NEW_VERSION}"
echo "✅ ${TAG} 태그 생성 완료"

# ── 2. Consistency check ──────────────────────────────────
echo "🔍 릴리스 일관성 점검..."
npm run docs:status:check
node scripts/release/check-release-consistency.js

# ── 3. Push commit + tag to canonical GitLab ──────────────
echo "🚀 Canonical push 중... (commit + tag -> ${CANONICAL_REMOTE}/main)"
git push --follow-tags "$CANONICAL_REMOTE" main

# ── 4. Wait for GitLab deploy authority ───────────────────
wait_for_gitlab_release_pipeline

# ── 5. Production verification ────────────────────────────
run_post_release_verification "$NEW_VERSION" "$TAG"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ 릴리스 완료: ${TAG}"
echo "📦 canonical remote: ${CANONICAL_REMOTE}"
echo "ℹ️  public snapshot은 별도 경로입니다: npm run sync:github"
echo "═══════════════════════════════════════════"
