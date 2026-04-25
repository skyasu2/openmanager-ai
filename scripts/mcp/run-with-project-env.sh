#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"
IS_GEMINI=false

if [ "${1:-}" = "gemini" ]; then
  IS_GEMINI=true
fi

should_load_env_key() {
  local key="$1"

  if [ "$IS_GEMINI" != "true" ]; then
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

if [ -f "$ENV_FILE" ]; then
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
          if ! should_load_env_key "$key"; then
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
fi

# Gemini CLI headless/subcommands can miss stored folder trust and then skip
# project MCP/skills or hang on a hidden trust prompt. This launcher is
# project-scoped, so trust the current OpenManager workspace for this process.
#
# Keep this launcher as a direct shell entrypoint, not an npm health-check
# wrapper. Gemini's self-relaunch can lose project-scoped trust/env behavior in
# headless subcommands, so disable relaunch for Gemini invocations. Strip
# npm-only variables as best-effort hygiene if someone calls it from npm.
if [ "${1:-}" = "gemini" ]; then
  while IFS='=' read -r key _; do
    case "$key" in
      npm_* | INIT_CWD | NODE | COLOR | EDITOR | GOOGLE_CLOUD_PROJECT | GOOGLE_CLOUD_LOCATION | GOOGLE_APPLICATION_CREDENTIALS | GOOGLE_GENAI_USE_VERTEXAI | GOOGLE_GENAI_USE_GCA | GEMINI_API_KEY | GEMINI_MODEL)
        unset "$key"
        ;;
    esac
  done < <(env)
fi

if [ "${1:-}" = "gemini" ]; then
  exec env GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true "$@"
fi

exec "$@"
