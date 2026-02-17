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

extract_config_value() {
  local key="$1"
  local file="$2"

  awk -v key="$key" '
    BEGIN { in_section = 0 }
    /^\[.*\]$/ {
      in_section = ($0 == "[mcp_servers.github.env]")
      next
    }
    in_section && $0 ~ ("^[[:space:]]*" key "[[:space:]]*=") {
      line = $0
      sub(/^[[:space:]]*[^=]+=[[:space:]]*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (line ~ /^".*"$/ || line ~ /^'\''.*'\''$/) {
        line = substr(line, 2, length(line) - 2)
      }
      print line
      exit
    }
  ' "$file"
}

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "WARN: $ENV_FILE not found, skip GitHub MCP token sync" >&2
  exit 0
fi

TOKEN="$(extract_env_value "GITHUB_PERSONAL_ACCESS_TOKEN" "$ENV_FILE" || true)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(extract_env_value "GITHUB_TOKEN" "$ENV_FILE" || true)"
fi

if [ -z "$TOKEN" ]; then
  echo "WARN: no GitHub PAT in $ENV_FILE, skip GitHub MCP token sync" >&2
  exit 0
fi

CURRENT_TOKEN="$(extract_config_value "GITHUB_PERSONAL_ACCESS_TOKEN" "$CONFIG_FILE" || true)"
if [ "$CURRENT_TOKEN" = "$TOKEN" ]; then
  exit 0
fi

TMP_FILE="$(mktemp)"
awk -v new_token="$TOKEN" '
  BEGIN {
    in_section = 0
    section_found = 0
    updated = 0
  }

  function print_token() {
    print "GITHUB_PERSONAL_ACCESS_TOKEN = \"" new_token "\""
    updated = 1
  }

  /^\[mcp_servers\.github\.env\][[:space:]]*$/ {
    in_section = 1
    section_found = 1
    print
    next
  }

  /^\[.*\]$/ {
    if (in_section && !updated) {
      print_token()
    }
    in_section = 0
    print
    next
  }

  {
    if (in_section && $0 ~ /^[[:space:]]*GITHUB_PERSONAL_ACCESS_TOKEN[[:space:]]*=/) {
      if (!updated) {
        print_token()
      }
      next
    }
    print
  }

  END {
    if (!section_found) {
      print ""
      print "[mcp_servers.github.env]"
      print_token()
    } else if (in_section && !updated) {
      print_token()
    }
  }
' "$CONFIG_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$CONFIG_FILE"
echo "INFO: synced GitHub MCP token from .env.local -> $CONFIG_FILE"
