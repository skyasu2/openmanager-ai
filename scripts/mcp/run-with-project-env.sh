#!/usr/bin/env bash
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

openmanager_project_env_mode() {
  if [ "${1:-}" = "gemini" ]; then
    printf 'gemini\n'
    return 0
  fi
  if [ "${1:-}" = "codex-mcp" ]; then
    printf 'codex-mcp\n'
    return 0
  fi
  printf 'default\n'
}

openmanager_should_load_env_key() {
  local mode="$1"
  local key="$2"

  case "$mode" in
    gemini | codex-mcp)
      ;;
    *)
      return 0
      ;;
  esac

  case "$key" in
    GITHUB_PERSONAL_ACCESS_TOKEN | GITHUB_TOKEN | SUPABASE_ACCESS_TOKEN | VERCEL_API_KEY | OPENMANAGER_MCP_CACHE_ROOT)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

openmanager_normalize_env_value() {
  local raw_value="$1"
  local value=""

  value="$(printf '%s' "$raw_value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if [[ "$value" =~ ^\"(.*)\"[[:space:]]*(#.*)?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$value" =~ ^\'(.*)\'[[:space:]]*(#.*)?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi

  value="$(printf '%s' "$value" | sed -e 's/[[:space:]]#.*$//' -e 's/[[:space:]]*$//')"
  printf '%s\n' "$value"
}

openmanager_load_project_env() {
  local mode="${1:-default}"
  local line=""
  local key=""
  local value=""

  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      '' | '#'*)
        continue
        ;;
      *)
        if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
          key="${BASH_REMATCH[2]}"
          value="$(openmanager_normalize_env_value "${BASH_REMATCH[3]}")"
          if ! openmanager_should_load_env_key "$mode" "$key"; then
            continue
          fi
          export "$key=$value"
        fi
        ;;
    esac
  done < "$ENV_FILE"

  if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    export GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_TOKEN"
  fi
}

# Gemini CLI headless/subcommands can miss stored folder trust and then skip
# project MCP/skills or hang on a hidden trust prompt. This launcher is
# project-scoped, so trust the current OpenManager workspace for this process.
#
openmanager_sanitize_gemini_env() {
  while IFS='=' read -r key _; do
    case "$key" in
      npm_* | INIT_CWD | NODE | COLOR | EDITOR | GOOGLE_CLOUD_PROJECT | GOOGLE_CLOUD_LOCATION | GOOGLE_APPLICATION_CREDENTIALS | GOOGLE_GENAI_USE_VERTEXAI | GOOGLE_GENAI_USE_GCA | GEMINI_API_KEY | GEMINI_MODEL)
        unset "$key"
        ;;
    esac
  done < <(env)
}

openmanager_run_with_project_env_main() {
  local mode=""

  mode="$(openmanager_project_env_mode "${1:-}")"
  openmanager_load_project_env "$mode"

  # Keep this launcher as a direct shell entrypoint, not an npm health-check
  # wrapper. Gemini's self-relaunch can lose project-scoped trust/env behavior in
  # headless subcommands, so disable relaunch for Gemini invocations. Strip
  # npm-only variables as best-effort hygiene if someone calls it from npm.
  if [ "$mode" = "gemini" ]; then
    openmanager_sanitize_gemini_env
    exec env GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true "$@"
  fi

  exec "$@"
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  openmanager_load_project_env "$(openmanager_project_env_mode "${1:-}")"
  return 0
fi

openmanager_run_with_project_env_main "$@"
