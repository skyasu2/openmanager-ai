#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ENV_RESOLVER="$REPO_ROOT/scripts/mcp/resolve-runtime-env.sh"
GITHUB_MCP_AUTH_SYNC="$REPO_ROOT/scripts/mcp/sync-github-mcp-auth.sh"
ORIGINAL_CONFIG_FILE=""
BACKUP_CONFIG_FILE=""
FILTERED_CONFIG_FILE=""
STORYBOOK_CONFIG_MUTATED=0

# OPENMANAGER_STORYBOOK_MCP_MODE:
# - on: 항상 포함
# - auto: Storybook MCP endpoint가 살아있을 때만 포함
get_storybook_mode() {
  local mode="${OPENMANAGER_STORYBOOK_MCP_MODE:-auto}"
  mode="$(printf '%s' "$mode" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    on|off|auto)
      printf '%s\n' "$mode"
      ;;
    *)
      printf 'off\n'
      ;;
  esac
}

has_storybook_server_section() {
  local config_file="$1"
  awk '
    /^\[mcp_servers\.storybook\]$/ {
      found = 1
    }
    END {
      if (found) {
        exit 0
      }
      exit 1
    }
  ' "$config_file"
}

read_storybook_url() {
  local config_file="$1"
  local url=""
  url="$(
    awk '
      /^\[mcp_servers\.storybook\]$/ {
        in_section = 1
        next
      }
      /^\[mcp_servers\./ {
        if (in_section) {
          exit
        }
      }
      in_section && /^[[:space:]]*url[[:space:]]*=/ {
        line = $0
        sub(/^[^"]*"/, "", line)
        sub(/".*$/, "", line)
        print line
        exit
      }
    ' "$config_file"
  )"
  if [ -n "$url" ]; then
    printf '%s\n' "$url"
    return 0
  fi
  printf 'http://localhost:6006/mcp\n'
}

is_storybook_reachable() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    if curl -sS -m 2 -o /dev/null "$url" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

filter_storybook_section() {
  local src="$1"
  local dst="$2"
  awk '
    /^\[mcp_servers\.storybook(\.env)?\]$/ {
      skip = 1
      next
    }
    /^\[mcp_servers\./ {
      skip = 0
    }
    !skip {
      print
    }
  ' "$src" > "$dst"
}

prepare_effective_codex_config() {
  local config_file="$CODEX_HOME/config.toml"
  local storybook_mode=""
  local storybook_url=""
  local include_storybook="1"

  if ! has_storybook_server_section "$config_file"; then
    return 0
  fi

  storybook_mode="$(get_storybook_mode)"
  case "$storybook_mode" in
    on)
      include_storybook="1"
      ;;
    off)
      include_storybook="0"
      ;;
    auto)
      storybook_url="$(read_storybook_url "$config_file")"
      if is_storybook_reachable "$storybook_url"; then
        include_storybook="1"
      else
        include_storybook="0"
      fi
      ;;
  esac

  if [ "$include_storybook" = "1" ]; then
    return 0
  fi

  ORIGINAL_CONFIG_FILE="$config_file"
  BACKUP_CONFIG_FILE="$(mktemp "${TMPDIR:-/tmp}/openmanager-codex-config.backup.XXXXXX")"
  FILTERED_CONFIG_FILE="$(mktemp "${TMPDIR:-/tmp}/openmanager-codex-config.filtered.XXXXXX")"

  cp "$ORIGINAL_CONFIG_FILE" "$BACKUP_CONFIG_FILE"
  filter_storybook_section "$ORIGINAL_CONFIG_FILE" "$FILTERED_CONFIG_FILE"
  cp "$FILTERED_CONFIG_FILE" "$ORIGINAL_CONFIG_FILE"

  STORYBOOK_CONFIG_MUTATED=1
}

cleanup_storybook_config_override() {
  if [ "$STORYBOOK_CONFIG_MUTATED" -eq 1 ] && [ -n "$BACKUP_CONFIG_FILE" ] && [ -f "$BACKUP_CONFIG_FILE" ] && [ -n "$ORIGINAL_CONFIG_FILE" ]; then
    cp "$BACKUP_CONFIG_FILE" "$ORIGINAL_CONFIG_FILE" || true
  fi

  if [ -n "$BACKUP_CONFIG_FILE" ] && [ -f "$BACKUP_CONFIG_FILE" ]; then
    rm -f "$BACKUP_CONFIG_FILE"
  fi
  if [ -n "$FILTERED_CONFIG_FILE" ] && [ -f "$FILTERED_CONFIG_FILE" ]; then
    rm -f "$FILTERED_CONFIG_FILE"
  fi
}

if [ ! -f "$RUNTIME_ENV_RESOLVER" ]; then
  echo "ERROR: $RUNTIME_ENV_RESOLVER not found"
  exit 2
fi

# Force project-scoped Codex config by default.
: "${OPENMANAGER_CODEX_HOME_MODE:=project}"
export OPENMANAGER_CODEX_HOME_MODE

# shellcheck source=/dev/null
source "$RUNTIME_ENV_RESOLVER"

if [ ! -f "$CODEX_HOME/config.toml" ]; then
  echo "ERROR: $CODEX_HOME/config.toml not found"
  echo "Hint: create $REPO_ROOT/.codex/config.toml or override OPENMANAGER_CODEX_HOME_MODE"
  exit 2
fi

if [ -x "$GITHUB_MCP_AUTH_SYNC" ]; then
  "$GITHUB_MCP_AUTH_SYNC" || true
fi

trap cleanup_storybook_config_override EXIT INT TERM
prepare_effective_codex_config

set +e
codex "$@"
CODEX_EXIT_CODE=$?
set -e

exit "$CODEX_EXIT_CODE"
