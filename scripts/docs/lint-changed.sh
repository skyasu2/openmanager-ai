#!/usr/bin/env bash
set -euo pipefail

ACTIVE_CONFIG="active.markdownlint-cli2.jsonc"
HISTORICAL_CONFIG="historical.markdownlint-cli2.jsonc"

TMP_FILE="$(mktemp)"

{
  git diff --name-only --diff-filter=ACMR
  git diff --name-only --cached --diff-filter=ACMR
  git ls-files --others --exclude-standard
} | grep -E '^(docs|reports/qa)/.*\.md$|^(AGENTS|CLAUDE|GEMINI|README)\.md$|^scripts/README\.md$|^\.claude/rules/.*\.md$|^\.(agents|claude)/skills/.*/SKILL\.md$' | sort -u > "$TMP_FILE" || true

if [[ ! -s "$TMP_FILE" ]]; then
  echo "No changed docs markdown files."
  rm -f "$TMP_FILE"
  exit 0
fi

ACTIVE_FILES=()
HISTORICAL_FILES=()

while IFS= read -r file; do
  if [[ \
    "$file" == docs/analysis/* || \
    "$file" == docs/reviews/* || \
    "$file" == docs/status.md || \
    "$file" == reports/qa/production-qa-* \
  ]]; then
    HISTORICAL_FILES+=("$file")
  else
    ACTIVE_FILES+=("$file")
  fi
done < "$TMP_FILE"

rm -f "$TMP_FILE"

if [[ ${#ACTIVE_FILES[@]} -gt 0 ]]; then
  echo "Linting changed active docs (${#ACTIVE_FILES[@]})..."
  npx markdownlint-cli2 --config "$ACTIVE_CONFIG" "${ACTIVE_FILES[@]}"
fi

if [[ ${#HISTORICAL_FILES[@]} -gt 0 ]]; then
  echo "Linting changed historical docs (${#HISTORICAL_FILES[@]})..."
  if npx markdownlint-cli2 --config "$HISTORICAL_CONFIG" "${HISTORICAL_FILES[@]}"; then
    echo "Historical docs lint passed."
  else
    echo "Historical docs lint has warnings/errors (non-blocking)."
  fi
fi

echo "Changed docs lint passed."
