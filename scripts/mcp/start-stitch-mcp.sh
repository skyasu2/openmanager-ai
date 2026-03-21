#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_GCLOUD_CONFIG="${HOME}/.config/gcloud"
WORKSPACE_GCLOUD_CONFIG="$REPO_ROOT/.codex/gcloud-config"
CACHED_NPX_ROOT="${HOME}/.npm/_npx"
STARTUP_LOG_PATH="${OPENMANAGER_STITCH_STARTUP_LOG:-}"
START_TIME_MS="$(date +%s%3N 2>/dev/null || printf '')"

has_gcloud_auth_material() {
  local dir="$1"
  [ -f "$dir/credentials.db" ] || [ -f "$dir/application_default_credentials.json" ] || [ -d "$dir/legacy_credentials" ]
}

log_startup_event() {
  local message="$1"
  local now_ms=""
  local elapsed_ms="n/a"

  if [ -z "$STARTUP_LOG_PATH" ]; then
    return 0
  fi

  mkdir -p "$(dirname "$STARTUP_LOG_PATH")"

  if [ -n "$START_TIME_MS" ]; then
    now_ms="$(date +%s%3N 2>/dev/null || printf '')"
    if [ -n "$now_ms" ]; then
      elapsed_ms="$((now_ms - START_TIME_MS))"
    fi
  fi

  printf '[%s] +%sms %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$elapsed_ms" "$message" >> "$STARTUP_LOG_PATH"
}

find_cached_stitch_mcp_bin() {
  local bin_path=""
  local latest=""

  if [ ! -d "$CACHED_NPX_ROOT" ]; then
    return 1
  fi

  latest="$(
    find "$CACHED_NPX_ROOT" -path '*/node_modules/.bin/stitch-mcp' -printf '%T@ %p\n' 2>/dev/null \
      | sort -nr \
      | sed -n '1p' \
      | cut -d' ' -f2-
  )"

  if [ -z "$latest" ] || [ ! -f "$latest" ]; then
    return 1
  fi

  bin_path="$latest"
  printf '%s\n' "$bin_path"
}

SELECTED_GCLOUD_CONFIG="${CLOUDSDK_CONFIG:-}"
log_startup_event "startup begin"

if [ -n "$SELECTED_GCLOUD_CONFIG" ] && ! has_gcloud_auth_material "$SELECTED_GCLOUD_CONFIG" && has_gcloud_auth_material "$DEFAULT_GCLOUD_CONFIG"; then
  SELECTED_GCLOUD_CONFIG="$DEFAULT_GCLOUD_CONFIG"
  log_startup_event "switched CLOUDSDK_CONFIG to default auth material"
fi

if [ -z "$SELECTED_GCLOUD_CONFIG" ]; then
  if [ -d "$DEFAULT_GCLOUD_CONFIG" ]; then
    SELECTED_GCLOUD_CONFIG="$DEFAULT_GCLOUD_CONFIG"
    log_startup_event "selected default CLOUDSDK_CONFIG"
  else
    mkdir -p "$WORKSPACE_GCLOUD_CONFIG"
    SELECTED_GCLOUD_CONFIG="$WORKSPACE_GCLOUD_CONFIG"
    log_startup_event "created workspace CLOUDSDK_CONFIG"
  fi
fi

export CLOUDSDK_CONFIG="$SELECTED_GCLOUD_CONFIG"
# Keep stdout clean for MCP JSON-RPC handshake.
export DOTENV_CONFIG_QUIET="${DOTENV_CONFIG_QUIET:-true}"
log_startup_event "resolved CLOUDSDK_CONFIG=$CLOUDSDK_CONFIG"

if CACHED_STITCH_MCP_BIN="$(find_cached_stitch_mcp_bin)"; then
  log_startup_event "launching cached stitch-mcp bin: $CACHED_STITCH_MCP_BIN"
  exec node "$CACHED_STITCH_MCP_BIN" proxy
fi

log_startup_event "launching via npx fallback"
exec npx -y @_davideast/stitch-mcp proxy
