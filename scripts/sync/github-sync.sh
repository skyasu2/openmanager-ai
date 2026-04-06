#!/usr/bin/env bash
# =============================================================================
# github-sync.sh — GitLab canonical → GitHub 공개 프론트엔드 스냅샷 동기화
#
# 동작:
#   1. 현재 HEAD(GitLab main)를 임시 디렉토리에 체크아웃
#   2. 공개 프론트엔드에 필요한 top-level 항목만 유지
#   3. 내부 전용 파일/디렉토리를 안전 필터로 제거
#   4. GitHub public remote(main) 에 스냅샷 커밋으로 push
#
# 사용법:
#   npm run sync:github              # 일반 실행
#   npm run sync:github -- --dry-run # 변경 목록만 미리보기 (push 없음)
#   bash scripts/sync/github-sync.sh --dry-run
# =============================================================================
set -euo pipefail
shopt -s dotglob nullglob globstar

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[sync]${NC} $*"; }
ok()    { echo -e "${GREEN}[sync]${NC} $*"; }
warn()  { echo -e "${YELLOW}[sync]${NC} $*"; }
error() { echo -e "${RED}[sync]${NC} $*" >&2; }

DRY_RUN=false
for arg in "$@"; do [[ "$arg" == "--dry-run" ]] && DRY_RUN=true; done

REPO_ROOT="$(git rev-parse --show-toplevel)"
PREFERRED_GITHUB_REMOTE="${GITHUB_PUBLIC_REMOTE:-github-public}"
LEGACY_GITHUB_REMOTE="${GITHUB_PUBLIC_LEGACY_REMOTE:-origin}"
INCLUDE_FILE="$REPO_ROOT/.github-export-include"
IGNORE_FILE="$REPO_ROOT/.github-export-ignore"
PUBLIC_README="$REPO_ROOT/scripts/sync/assets/README.public.md"
ALLOW_DIRTY="${SYNC_GITHUB_ALLOW_DIRTY:-0}"
ALLOW_NON_MAIN="${SYNC_GITHUB_ALLOW_NON_MAIN:-0}"

resolve_github_remote() {
  local remote
  for remote in "$PREFERRED_GITHUB_REMOTE" "$LEGACY_GITHUB_REMOTE"; do
    [[ -z "$remote" ]] && continue
    if git remote get-url "$remote" &>/dev/null; then
      printf '%s\n' "$remote"
      return 0
    fi
  done
  return 1
}

GITHUB_REMOTE="$(resolve_github_remote || true)"

if [[ -z "$GITHUB_REMOTE" ]]; then
  error "GitHub public remote 없음. '$PREFERRED_GITHUB_REMOTE' 또는 '$LEGACY_GITHUB_REMOTE' 확인 필요"
  exit 1
fi

if [[ ! -f "$INCLUDE_FILE" ]]; then
  error "포함 규칙 파일 없음: $INCLUDE_FILE"
  exit 1
fi

if [[ ! -f "$IGNORE_FILE" ]]; then
  error "안전 제외 규칙 파일 없음: $IGNORE_FILE"
  exit 1
fi

GITHUB_URL=$(git remote get-url "$GITHUB_REMOTE")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=format:"%s")

if [[ "$CURRENT_BRANCH" != "main" && "$ALLOW_NON_MAIN" != "1" ]]; then
  error "현재 브랜치 '$CURRENT_BRANCH'. 기본 동기화는 main 에서만 허용됨"
  error "예외가 필요하면 SYNC_GITHUB_ALLOW_NON_MAIN=1 로 명시"
  exit 1
fi

if [[ -n "$(git status --porcelain)" && "$ALLOW_DIRTY" != "1" ]]; then
  error "워킹 트리가 dirty 상태입니다. HEAD 기준 스냅샷 혼선을 막기 위해 중단합니다"
  error "해결 방법:"
  error "  1. 변경사항 커밋:  git add -A && git commit -m 'wip'"
  error "  2. 임시 보관:      git stash && npm run sync:github && git stash pop"
  error "  3. 강제 허용:      SYNC_GITHUB_ALLOW_DIRTY=1 npm run sync:github"
  exit 1
fi

info "─────────────────────────────────────────────"
info "GitLab → GitHub 공개 프론트엔드 스냅샷 동기화"
info "  소스 브랜치: $CURRENT_BRANCH ($COMMIT_SHA)"
info "  대상 remote: $GITHUB_REMOTE ($GITHUB_URL)"
info "  포함 규칙: $INCLUDE_FILE"
info "  안전 제외 규칙: $IGNORE_FILE"
$DRY_RUN && warn "  [DRY-RUN 모드] — push 없이 미리보기만"
[[ "$GITHUB_REMOTE" == "$LEGACY_GITHUB_REMOTE" ]] && warn "  legacy GitHub remote 이름 사용 중: $GITHUB_REMOTE"
info "─────────────────────────────────────────────"

WORK_DIR=$(mktemp -d /tmp/github-sync-XXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

info "임시 디렉토리: $WORK_DIR"
info "현재 HEAD 내용 추출 중..."
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$WORK_DIR"

apply_frontend_scope() {
  local raw entry target rel
  local -A allowed_entries=()

  info "공개 프론트엔드 범위 적용 중..."
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    entry="${raw%%#*}"
    entry="${entry#"${entry%%[![:space:]]*}"}"
    entry="${entry%"${entry##*[![:space:]]}"}"
    entry="${entry%/}"
    [[ -z "$entry" ]] && continue
    allowed_entries["$entry"]=1
  done < "$INCLUDE_FILE"

  shopt -s dotglob nullglob
  for target in "$WORK_DIR"/*; do
    [[ -e "$target" ]] || continue
    rel="${target#$WORK_DIR/}"
    if [[ -n "${allowed_entries[$rel]:-}" ]]; then
      continue
    fi

    $DRY_RUN && warn "  공개 제외: $rel" || rm -rf "$target"
  done
}

apply_excludes() {
  local raw pattern target rel

  info "내부 전용 항목 제거 중..."
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    pattern="${raw%%#*}"
    pattern="${pattern#"${pattern%%[![:space:]]*}"}"
    pattern="${pattern%"${pattern##*[![:space:]]}"}"

    [[ -z "$pattern" ]] && continue

    for target in "$WORK_DIR"/$pattern; do
      [[ -e "$target" ]] || continue
      rel="${target#$WORK_DIR/}"
      $DRY_RUN && warn "  제거 예정: $rel" || rm -rf "$target"
    done
  done < "$IGNORE_FILE"
}

apply_public_overrides() {
  if [[ -f "$PUBLIC_README" ]]; then
    info "공개 README 적용 중..."
    cp "$PUBLIC_README" "$WORK_DIR/README.md"
    node "$REPO_ROOT/scripts/sync/render-public-readme.js" \
      "$WORK_DIR/README.md" \
      "$REPO_ROOT/package.json"
  fi

  if [[ -f "$WORK_DIR/package.json" ]]; then
    info "공개 package.json 스크립트 정리 중..."
    # 허용 목록: 공개 저장소에 노출해도 안전한 스크립트만 선택
    PUBLIC_SCRIPT_ALLOWLIST='["dev","build","start","type-check","lint","format"]'
    PUBLIC_SCRIPT_OVERRIDES='{"type-check":"tsc --noEmit","lint":"biome lint .","format":"biome format --write ."}'
    node "$REPO_ROOT/scripts/sync/filter-public-scripts.js" \
      "$WORK_DIR/package.json" \
      "$PUBLIC_SCRIPT_ALLOWLIST" \
      "$PUBLIC_SCRIPT_OVERRIDES"
  fi
}

apply_frontend_scope
apply_excludes

apply_public_overrides

if $DRY_RUN; then
  warn "─────────────────────────────────────────────"
  warn "DRY-RUN 완료. 위 항목이 공개 프론트엔드 스냅샷에서 제외됩니다."
  warn "실제 동기화: npm run sync:github"
  exit 0
fi

# ── GitHub 전용 git 초기화 ─────────────────────────────────────────────────
info "GitHub 레포 초기화..."
cd "$WORK_DIR"
git init -q
git config user.name "$(git -C "$REPO_ROOT" config user.name 2>/dev/null || echo 'OpenManager Sync')"
git config user.email "$(git -C "$REPO_ROOT" config user.email 2>/dev/null || echo 'sync@openmanager-ai')"
git checkout -q -b main
git remote add "$GITHUB_REMOTE" "$GITHUB_URL"

# 기존 GitHub 히스토리를 부모로 연결 시도
info "GitHub 기존 히스토리 연결 시도..."
if git fetch --depth=1 "$GITHUB_REMOTE" main 2>/dev/null; then
  git update-ref refs/heads/main FETCH_HEAD
  git symbolic-ref HEAD refs/heads/main
  git reset --mixed >/dev/null 2>&1
  info "기존 히스토리에 연결됨"
else
  warn "GitHub 레포가 비어있거나 연결 불가 → 초기 커밋으로 시작"
fi

git add -A
CHANGED=$(git diff --cached --name-only | wc -l)

if [[ "$CHANGED" -eq 0 ]]; then
  ok "변경 없음 — GitHub가 이미 최신 상태입니다."
  exit 0
fi

info "변경된 파일: $CHANGED 개"

SYNC_MSG="sync: frontend public snapshot from gitlab@${COMMIT_SHA}

${COMMIT_MSG}

GitLab canonical: ${CURRENT_BRANCH}
Synced-at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

git commit -q -m "$SYNC_MSG"

info "GitHub에 push 중..."
git push "$GITHUB_REMOTE" main --force-with-lease 2>/dev/null || git push "$GITHUB_REMOTE" main --force

ok "─────────────────────────────────────────────"
ok "동기화 완료!"
ok "  커밋: $COMMIT_SHA ($COMMIT_MSG)"
ok "  GitHub: $GITHUB_URL"
ok "─────────────────────────────────────────────"
