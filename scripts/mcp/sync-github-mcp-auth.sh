#!/usr/bin/env bash
set -euo pipefail

resolve_script_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

GITHUB_MCP_SCRIPT_DIR="$(resolve_script_dir)"
GITHUB_MCP_REPO_ROOT="$(cd "$GITHUB_MCP_SCRIPT_DIR/../.." && pwd)"
GITHUB_MCP_ENV_FILE="$GITHUB_MCP_REPO_ROOT/.env.local"
GITHUB_MCP_CODEX_HOME_DIR="${CODEX_HOME:-$GITHUB_MCP_REPO_ROOT/.codex}"
GITHUB_MCP_CONFIG_FILE="$GITHUB_MCP_CODEX_HOME_DIR/config.toml"

extract_env_value() {
  local key="$1"
  local file="$2"

  awk -v key="$key" '
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      line = $0
      sub(/^[[:space:]]*[^=]+=[[:space:]]*/, "", line)
      sub(/[[:space:]]*#.*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (line ~ /^".*"$/ || line ~ /^'\''.*'\''$/) {
        line = substr(line, 2, length(line) - 2)
      }
      print line
      exit
    }
  ' "$file"
}

has_legacy_inline_github_token() {
  local file="$1"

  awk '
    BEGIN { in_section = 0; found = 0 }
    /^\[.*\]$/ {
      in_section = ($0 == "[mcp_servers.github.env]")
      next
    }
    in_section && /^[[:space:]]*GITHUB_PERSONAL_ACCESS_TOKEN[[:space:]]*=/ {
      line = $0
      sub(/^[[:space:]]*[^=]+=[[:space:]]*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (line ~ /^".*"$/ || line ~ /^'\''.*'\''$/) {
        line = substr(line, 2, length(line) - 2)
      }
      if (line != "" && line != "__OPENMANAGER_RUNTIME_ENV__") {
        found = 1
      }
      exit
    }
    END {
      exit found ? 0 : 1
    }
  ' "$file"
}

resolve_github_mcp_token() {
  local token="${GITHUB_PERSONAL_ACCESS_TOKEN:-${GITHUB_TOKEN:-}}"

  if [ -z "$token" ] && [ -f "$GITHUB_MCP_ENV_FILE" ]; then
    token="$(extract_env_value "GITHUB_PERSONAL_ACCESS_TOKEN" "$GITHUB_MCP_ENV_FILE" || true)"
  fi
  if [ -z "$token" ] && [ -f "$GITHUB_MCP_ENV_FILE" ]; then
    token="$(extract_env_value "GITHUB_TOKEN" "$GITHUB_MCP_ENV_FILE" || true)"
  fi

  printf '%s\n' "$token"
}

sync_github_mcp_auth_main() {
  local mode="${1:-}"
  local token=""

  if [ -z "$mode" ]; then
    mode="--check"
  fi

  if [ "$mode" != "--check" ] && [ "$mode" != "--export-env" ]; then
    echo "Usage: $0 [--check|--export-env]" >&2
    return 2
  fi

  token="$(resolve_github_mcp_token)"

  if [ "$mode" = "--export-env" ] && [ -n "$token" ]; then
    export GITHUB_PERSONAL_ACCESS_TOKEN="$token"
  fi

  if [ -z "$token" ]; then
    echo "WARN: no GitHub PAT in shell env or $GITHUB_MCP_ENV_FILE; GitHub MCP will be disabled in auto mode" >&2
  else
    echo "INFO: GitHub MCP token resolved from runtime env" >&2
  fi

  if [ -f "$GITHUB_MCP_CONFIG_FILE" ] && has_legacy_inline_github_token "$GITHUB_MCP_CONFIG_FILE"; then
    echo "WARN: legacy inline GitHub MCP token still present in $GITHUB_MCP_CONFIG_FILE; runtime env injection should be preferred" >&2
  fi

  return 0
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  sync_github_mcp_auth_main "$@"
  return $?
fi

sync_github_mcp_auth_main "$@"
