#!/usr/bin/env bash
set -euo pipefail

DOC_PATH="docs/reference/architecture/system/component-dependency-map.md"
JSON_PATH="reports/docs/component-dependency-map.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DOC_BEFORE="$TMP_DIR/component-dependency-map.md.before"
JSON_BEFORE="$TMP_DIR/component-dependency-map.json.before"
DOC_WAS_PRESENT=0
JSON_WAS_PRESENT=0

if [[ -f "$DOC_PATH" ]]; then
  cp "$DOC_PATH" "$DOC_BEFORE"
  DOC_WAS_PRESENT=1
fi

if [[ -f "$JSON_PATH" ]]; then
  cp "$JSON_PATH" "$JSON_BEFORE"
  JSON_WAS_PRESENT=1
fi

npm run --silent docs:components:map >/dev/null

if [[ ! -f "$DOC_PATH" ]]; then
  echo "ERROR: Missing generated file: $DOC_PATH"
  echo "Run: npm run docs:components:map"
  exit 1
fi

if [[ ! -f "$JSON_PATH" ]]; then
  echo "ERROR: Missing generated file: $JSON_PATH"
  echo "Run: npm run docs:components:map"
  exit 1
fi

if [[ "$DOC_WAS_PRESENT" -ne 1 ]] || [[ "$JSON_WAS_PRESENT" -ne 1 ]] ||
  ! cmp -s "$DOC_BEFORE" "$DOC_PATH" ||
  ! cmp -s "$JSON_BEFORE" "$JSON_PATH"; then
  echo "ERROR: Component dependency map is out of date."
  echo "Run: npm run docs:components:map"
  echo "--- diff preview (first 200 lines) ---"
  git --no-pager diff -- "$DOC_PATH" "$JSON_PATH" | sed -n '1,200p'
  exit 1
fi

echo "OK: Component dependency map is up to date."
