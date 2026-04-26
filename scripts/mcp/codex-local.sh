#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ENV_RESOLVER="$REPO_ROOT/scripts/mcp/resolve-runtime-env.sh"
GITHUB_MCP_AUTH_SYNC="$REPO_ROOT/scripts/mcp/sync-github-mcp-auth.sh"
ORIGINAL_CONFIG_FILE=""
BACKUP_CONFIG_FILE=""
FILTERED_CONFIG_FILE=""
EFFECTIVE_CONFIG_MUTATED=0

is_openmanager_codex_launcher() {
  local candidate="$1"
  [ -f "$candidate" ] && grep -q 'OPENMANAGER_CODEX_LAUNCHER=1' "$candidate" 2>/dev/null
}

resolve_codex_bin() {
  local candidate=""

  if [ -n "${OPENMANAGER_REAL_CODEX_BIN:-}" ]; then
    if [ -x "$OPENMANAGER_REAL_CODEX_BIN" ]; then
      printf '%s\n' "$OPENMANAGER_REAL_CODEX_BIN"
      return 0
    fi

    echo "ERROR: OPENMANAGER_REAL_CODEX_BIN is not executable: $OPENMANAGER_REAL_CODEX_BIN" >&2
    return 2
  fi

  while IFS= read -r candidate; do
    if [ -z "$candidate" ] || is_openmanager_codex_launcher "$candidate"; then
      continue
    fi

    printf '%s\n' "$candidate"
    return 0
  done < <(type -P -a codex 2>/dev/null || true)

  echo "ERROR: codex binary not found in PATH" >&2
  return 2
}

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

get_github_mode() {
  local mode="${OPENMANAGER_GITHUB_MCP_MODE:-auto}"
  mode="$(printf '%s' "$mode" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    on|off|auto)
      printf '%s\n' "$mode"
      ;;
    *)
      printf 'auto\n'
      ;;
  esac
}

has_mcp_server_section() {
  local config_file="$1"
  local server="$2"
  awk -v section="[mcp_servers.${server}]" '
    $0 == section {
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

github_mcp_token_available() {
  [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]
}

filter_mcp_server_sections() {
  local src="$1"
  local dst="$2"
  shift 2
  awk -v excluded_servers="$*" '
    function is_excluded_section(line,    i, count, servers, section, prefix) {
      count = split(excluded_servers, servers, " ")
      for (i = 1; i <= count; i++) {
        section = "[mcp_servers." servers[i] "]"
        prefix = "[mcp_servers." servers[i] "."
        if (line == section || index(line, prefix) == 1) {
          return 1
        }
      }
      return 0
    }
    /^\[mcp_servers\./ && is_excluded_section($0) {
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
  local github_mode=""
  local include_github="1"
  local excluded_servers=()

  if has_mcp_server_section "$config_file" "storybook"; then
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

    if [ "$include_storybook" = "0" ]; then
      excluded_servers+=("storybook")
    fi
  fi

  if has_mcp_server_section "$config_file" "github"; then
    github_mode="$(get_github_mode)"
    case "$github_mode" in
      on)
        include_github="1"
        ;;
      off)
        include_github="0"
        ;;
      auto)
        if github_mcp_token_available; then
          include_github="1"
        else
          include_github="0"
        fi
        ;;
    esac

    if [ "$include_github" = "0" ]; then
      excluded_servers+=("github")
    fi
  fi

  if [ "${#excluded_servers[@]}" -eq 0 ]; then
    return 0
  fi

  ORIGINAL_CONFIG_FILE="$config_file"
  BACKUP_CONFIG_FILE="$(mktemp "${TMPDIR:-/tmp}/openmanager-codex-config.backup.XXXXXX")"
  FILTERED_CONFIG_FILE="$(mktemp "${TMPDIR:-/tmp}/openmanager-codex-config.filtered.XXXXXX")"

  cp "$ORIGINAL_CONFIG_FILE" "$BACKUP_CONFIG_FILE"
  filter_mcp_server_sections "$ORIGINAL_CONFIG_FILE" "$FILTERED_CONFIG_FILE" "${excluded_servers[@]}"
  cp "$FILTERED_CONFIG_FILE" "$ORIGINAL_CONFIG_FILE"

  EFFECTIVE_CONFIG_MUTATED=1
}

cleanup_effective_config_override() {
  if [ "$EFFECTIVE_CONFIG_MUTATED" -eq 1 ] && [ -n "$BACKUP_CONFIG_FILE" ] && [ -f "$BACKUP_CONFIG_FILE" ] && [ -n "$ORIGINAL_CONFIG_FILE" ]; then
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

if [ -f "$GITHUB_MCP_AUTH_SYNC" ]; then
  # shellcheck source=/dev/null
  source "$GITHUB_MCP_AUTH_SYNC" --export-env || true
fi

trap cleanup_effective_config_override EXIT INT TERM
prepare_effective_codex_config

CODEX_BIN="$(resolve_codex_bin)" || exit $?

set +e
"$CODEX_BIN" "$@"
CODEX_EXIT_CODE=$?
set -e

exit "$CODEX_EXIT_CODE"
