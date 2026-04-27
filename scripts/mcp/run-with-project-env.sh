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
  printf 'default\n'
}

openmanager_should_load_env_key() {
  local mode="$1"
  local key="$2"

  if [ "$mode" != "gemini" ]; then
    return 0
  fi

  case "$key" in
    GITHUB_PERSONAL_ACCESS_TOKEN | GITHUB_TOKEN | SUPABASE_ACCESS_TOKEN | VERCEL_API_KEY | OPENMANAGER_MCP_CACHE_ROOT)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
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
      export\ [A-Za-z_]*=* | [A-Za-z_]*=*)
        line="${line#export }"
        key="${line%%=*}"
        value="${line#*=}"
        if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          if ! openmanager_should_load_env_key "$mode" "$key"; then
            continue
          fi
          if [[ "$value" == \"*\" && "$value" == *\" ]]; then
            value="${value:1:${#value}-2}"
          elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
            value="${value:1:${#value}-2}"
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
