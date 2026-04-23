#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"
CODEX_HOME_DIR="${CODEX_HOME:-$REPO_ROOT/.codex}"
CONFIG_FILE="$CODEX_HOME_DIR/config.toml"

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

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f "$ENV_FILE" ]; then
  TOKEN="$(extract_env_value "GITHUB_PERSONAL_ACCESS_TOKEN" "$ENV_FILE" || true)"
fi
if [ -z "$TOKEN" ] && [ -f "$ENV_FILE" ]; then
  TOKEN="$(extract_env_value "GITHUB_TOKEN" "$ENV_FILE" || true)"
fi

if [ -z "$TOKEN" ]; then
  echo "WARN: no GitHub PAT in shell env or $ENV_FILE; GitHub MCP may fail at runtime" >&2
else
  echo "INFO: GitHub MCP token resolved from runtime env" >&2
fi

if has_legacy_inline_github_token "$CONFIG_FILE"; then
  echo "WARN: legacy inline GitHub MCP token still present in $CONFIG_FILE; runtime env injection should be preferred" >&2
fi
