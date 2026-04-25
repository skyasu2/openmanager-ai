#!/usr/bin/env bash
set -euo pipefail

DOC_PATH="docs/reference/architecture/system/component-dependency-map.md"
JSON_PATH="reports/docs/component-dependency-map.json"

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

if ! git diff --quiet -- "$DOC_PATH" "$JSON_PATH"; then
  echo "ERROR: Component dependency map is out of date."
  echo "Run: npm run docs:components:map"
  echo "--- diff preview (first 200 lines) ---"
  git --no-pager diff -- "$DOC_PATH" "$JSON_PATH" | sed -n '1,200p'
  exit 1
fi

echo "OK: Component dependency map is up to date."
