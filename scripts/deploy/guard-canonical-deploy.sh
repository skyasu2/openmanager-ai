#!/usr/bin/env bash
set -euo pipefail

allow_local="${ALLOW_LOCAL_VERCEL_DEPLOY:-false}"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
push_default="$(git config --get remote.pushDefault 2>/dev/null || true)"

if [[ "$allow_local" != "true" ]]; then
  cat <<'EOF'
❌ Local Vercel deploy is blocked by policy.
   Canonical production deploy path is: git push gitlab main -> GitLab CI deploy job.
   If you explicitly need a one-off local deploy, rerun with:
   ALLOW_LOCAL_VERCEL_DEPLOY=true npm run deploy:safe
EOF
  exit 1
fi

if [[ "$branch" != "main" ]]; then
  echo "❌ Local deploy guard: current branch must be main (current: ${branch:-unknown})"
  exit 1
fi

if [[ "$upstream" != "gitlab/main" ]]; then
  echo "❌ Local deploy guard: upstream must be gitlab/main (current: ${upstream:-none})"
  exit 1
fi

if [[ "$push_default" != "gitlab" ]]; then
  echo "❌ Local deploy guard: remote.pushDefault must be gitlab (current: ${push_default:-none})"
  exit 1
fi

echo "✅ Canonical deploy guard passed (explicit local override)."
