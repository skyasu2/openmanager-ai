#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_GCLOUD_CONFIG="${HOME}/.config/gcloud"
WORKSPACE_GCLOUD_CONFIG="$REPO_ROOT/.codex/gcloud-config"

has_gcloud_auth_material() {
  local dir="$1"
  [ -f "$dir/credentials.db" ] || [ -f "$dir/application_default_credentials.json" ] || [ -d "$dir/legacy_credentials" ]
}

SELECTED_GCLOUD_CONFIG="${CLOUDSDK_CONFIG:-}"

if [ -n "$SELECTED_GCLOUD_CONFIG" ] && ! has_gcloud_auth_material "$SELECTED_GCLOUD_CONFIG" && has_gcloud_auth_material "$DEFAULT_GCLOUD_CONFIG"; then
  SELECTED_GCLOUD_CONFIG="$DEFAULT_GCLOUD_CONFIG"
fi

if [ -z "$SELECTED_GCLOUD_CONFIG" ]; then
  if [ -d "$DEFAULT_GCLOUD_CONFIG" ]; then
    SELECTED_GCLOUD_CONFIG="$DEFAULT_GCLOUD_CONFIG"
  else
    mkdir -p "$WORKSPACE_GCLOUD_CONFIG"
    SELECTED_GCLOUD_CONFIG="$WORKSPACE_GCLOUD_CONFIG"
  fi
fi

export CLOUDSDK_CONFIG="$SELECTED_GCLOUD_CONFIG"
# Keep stdout clean for MCP JSON-RPC handshake.
export DOTENV_CONFIG_QUIET="${DOTENV_CONFIG_QUIET:-true}"
exec npx -y @_davideast/stitch-mcp proxy
