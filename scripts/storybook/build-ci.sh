#!/usr/bin/env bash

set -euo pipefail

# Storybook full build can take several minutes in this repository.
# Keep CI non-interactive and fail deterministically on excessive runtime.
TIMEOUT_SEC="${STORYBOOK_BUILD_TIMEOUT_SEC:-900}"

if command -v timeout >/dev/null 2>&1; then
  echo "[storybook:build:ci] timeout=${TIMEOUT_SEC}s"
  timeout "${TIMEOUT_SEC}s" storybook build --disable-telemetry --quiet
else
  echo "[storybook:build:ci] timeout command not found; running without timeout"
  storybook build --disable-telemetry --quiet
fi
