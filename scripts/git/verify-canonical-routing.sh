#!/usr/bin/env bash
set -euo pipefail

failures=0
warnings=0

pass() {
  printf '✅ %s\n' "$1"
}

warn() {
  warnings=$((warnings + 1))
  printf '⚠️  %s\n' "$1"
}

fail() {
  failures=$((failures + 1))
  printf '❌ %s\n' "$1"
}

check_equal() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label: $actual"
  else
    fail "$label expected '$expected' (actual: '${actual:-<empty>}')"
  fi
}

has_fixed_text() {
  local text="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q --fixed-strings "$text" "$file"
    return $?
  fi
  grep -qF "$text" "$file"
}

count_pattern_matches() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -o "$pattern" "$file" | wc -l | tr -d ' '
    return 0
  fi
  grep -oE "$pattern" "$file" | wc -l | tr -d ' '
}

echo "== Canonical Routing Verify =="

gitlab_url="$(git remote get-url gitlab 2>/dev/null || true)"
origin_url="$(git remote get-url origin 2>/dev/null || true)"

if [[ -n "$gitlab_url" ]]; then
  pass "gitlab remote exists ($gitlab_url)"
else
  fail "gitlab remote is missing"
fi

if [[ -n "$origin_url" ]]; then
  pass "origin remote exists ($origin_url)"
else
  warn "origin remote is missing (public snapshot sync unavailable)"
fi

if [[ -n "$gitlab_url" && "$gitlab_url" != *"gitlab.com"* ]]; then
  warn "gitlab remote does not look like gitlab.com URL ($gitlab_url)"
fi

if [[ -n "$origin_url" && "$origin_url" != *"github.com"* ]]; then
  warn "origin remote does not look like github.com URL ($origin_url)"
fi

check_equal \
  "remote.pushDefault(local)" \
  "$(git config --local --get remote.pushDefault 2>/dev/null || true)" \
  "gitlab"

check_equal \
  "branch.main.remote(local)" \
  "$(git config --local --get branch.main.remote 2>/dev/null || true)" \
  "gitlab"

check_equal \
  "branch.main.merge(local)" \
  "$(git config --local --get branch.main.merge 2>/dev/null || true)" \
  "refs/heads/main"

check_equal \
  "branch.main.vscode-merge-base(local)" \
  "$(git config --local --get branch.main.vscode-merge-base 2>/dev/null || true)" \
  "gitlab/main"

if has_fixed_text 'npm run hook:pre-push -- "$@"' .husky/pre-push; then
  pass "husky pre-push forwards remote args"
else
  fail "husky pre-push does not forward hook args"
fi

if has_fixed_text "ALLOW_GITHUB_PUBLIC_RELEASE_PUSH == 'true'" .github/workflows/release-manual.yml; then
  pass "release-manual workflow is gated by ALLOW_GITHUB_PUBLIC_RELEASE_PUSH"
else
  fail "release-manual workflow missing ALLOW_GITHUB_PUBLIC_RELEASE_PUSH gate"
fi

protected_count="$(count_pattern_matches '\$CI_COMMIT_REF_PROTECTED == "true"' .gitlab-ci.yml)"
if [[ "${protected_count:-0}" -ge 3 ]]; then
  pass ".gitlab-ci.yml has protected-main deploy gates ($protected_count)"
else
  fail ".gitlab-ci.yml missing protected-main deploy gates (found: ${protected_count:-0})"
fi

deploy_safe_cmd="$(node -p "require('./package.json').scripts['deploy:safe']" 2>/dev/null || true)"
if [[ "$deploy_safe_cmd" == *"deploy:guard:canonical"* ]]; then
  pass "deploy:safe includes canonical deploy guard"
else
  fail "deploy:safe is missing deploy:guard:canonical"
fi

if [[ -f "scripts/gitlab/check-main-protection.mjs" ]]; then
  pass "GitLab main protection audit script exists"
else
  fail "scripts/gitlab/check-main-protection.mjs is missing"
fi

echo
echo "== Result =="
if [[ "$failures" -gt 0 ]]; then
  echo "FAILED: $failures error(s), $warnings warning(s)"
  exit 1
fi

echo "PASSED: 0 error(s), $warnings warning(s)"
