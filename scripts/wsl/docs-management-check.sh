#!/usr/bin/env bash
# WSL 전용 문서 관리 체크 래퍼
# Usage:
#   bash scripts/wsl/docs-management-check.sh [--strict] [--fix]

set -euo pipefail

STRICT_MODE=false
FIX_MODE=false

for arg in "$@"; do
  case "$arg" in
    --strict)
      STRICT_MODE=true
      ;;
    --fix)
      FIX_MODE=true
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: bash scripts/wsl/docs-management-check.sh [--strict] [--fix]"
      exit 1
      ;;
  esac
done

if ! grep -qiE "(microsoft|wsl)" /proc/sys/kernel/osrelease 2>/dev/null; then
  echo "This script is intended to run inside WSL."
  exit 1
fi

REPORTS_DIR="logs/docs-reports/wsl"
mkdir -p "$REPORTS_DIR"

ENV_FILE="$REPORTS_DIR/environment.txt"
{
  echo "timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "kernel=$(uname -r)"
  echo "node=$(node -v)"
  echo "npm=$(npm -v)"
  echo "strict_mode=${STRICT_MODE}"
  echo "fix_mode=${FIX_MODE}"
} > "$ENV_FILE"

CHECK_LOG="$REPORTS_DIR/docs-check.log"
BUDGET_LOG="$REPORTS_DIR/docs-budget.log"

if $FIX_MODE; then
  npm run docs:check:fix 2>&1 | tee "$CHECK_LOG"
else
  npm run docs:check 2>&1 | tee "$CHECK_LOG"
fi

if $STRICT_MODE; then
  npm run docs:budget:strict 2>&1 | tee "$BUDGET_LOG"
else
  npm run docs:budget 2>&1 | tee "$BUDGET_LOG"
fi

echo "WSL docs check completed."
echo "  - Environment: $ENV_FILE"
echo "  - Docs check:  $CHECK_LOG"
echo "  - Budget:      $BUDGET_LOG"
