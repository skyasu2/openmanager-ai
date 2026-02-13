#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_CODEX_HOME="$REPO_ROOT/.codex"
HOME_CODEX_HOME="${HOME:-}/.codex"
HOME_GCLOUD_CONFIG="${HOME:-}/.config/gcloud"

OPENMANAGER_CODEX_HOME_MODE="${OPENMANAGER_CODEX_HOME_MODE:-auto}"
OPENMANAGER_GCLOUD_CONFIG_MODE="${OPENMANAGER_GCLOUD_CONFIG_MODE:-auto}"

OPENMANAGER_CODEX_HOME_SOURCE="unresolved"
OPENMANAGER_GCLOUD_CONFIG_SOURCE="unresolved"

can_write_dir() {
  local dir="$1"
  mkdir -p "$dir" 2>/dev/null || return 1
  local probe_file="$dir/.openmanager-write-test-$$"

  if (: >"$probe_file") >/dev/null 2>&1; then
    rm -f "$probe_file" >/dev/null 2>&1 || true
    return 0
  fi

  return 1
}

require_config_file() {
  local dir="$1"
  [ -f "$dir/config.toml" ]
}

choose_codex_home_from_mode() {
  local mode="$1"

  case "$mode" in
    project)
      if can_write_dir "$PROJECT_CODEX_HOME" && require_config_file "$PROJECT_CODEX_HOME"; then
        CODEX_HOME="$PROJECT_CODEX_HOME"
        OPENMANAGER_CODEX_HOME_SOURCE="project"
        return 0
      fi
      ;;
    home)
      if can_write_dir "$HOME_CODEX_HOME" && require_config_file "$HOME_CODEX_HOME"; then
        CODEX_HOME="$HOME_CODEX_HOME"
        OPENMANAGER_CODEX_HOME_SOURCE="home"
        return 0
      fi
      ;;
    auto)
      if [ -n "${CODEX_HOME:-}" ] && can_write_dir "$CODEX_HOME" && require_config_file "$CODEX_HOME"; then
        OPENMANAGER_CODEX_HOME_SOURCE="env"
        return 0
      fi

      if can_write_dir "$HOME_CODEX_HOME" && require_config_file "$HOME_CODEX_HOME"; then
        CODEX_HOME="$HOME_CODEX_HOME"
        OPENMANAGER_CODEX_HOME_SOURCE="home"
        return 0
      fi

      if can_write_dir "$PROJECT_CODEX_HOME" && require_config_file "$PROJECT_CODEX_HOME"; then
        CODEX_HOME="$PROJECT_CODEX_HOME"
        OPENMANAGER_CODEX_HOME_SOURCE="project-fallback"
        return 0
      fi
      ;;
  esac

  return 1
}

choose_gcloud_config_from_mode() {
  local mode="$1"

  case "$mode" in
    project)
      local project_gcloud_dir="$CODEX_HOME/gcloud-config"
      if can_write_dir "$project_gcloud_dir"; then
        CLOUDSDK_CONFIG="$project_gcloud_dir"
        OPENMANAGER_GCLOUD_CONFIG_SOURCE="project"
        return 0
      fi
      ;;
    home)
      if can_write_dir "$HOME_GCLOUD_CONFIG"; then
        CLOUDSDK_CONFIG="$HOME_GCLOUD_CONFIG"
        OPENMANAGER_GCLOUD_CONFIG_SOURCE="home"
        return 0
      fi
      ;;
    auto)
      if [ -n "${CLOUDSDK_CONFIG:-}" ] && can_write_dir "$CLOUDSDK_CONFIG"; then
        OPENMANAGER_GCLOUD_CONFIG_SOURCE="env"
        return 0
      fi

      if can_write_dir "$HOME_GCLOUD_CONFIG"; then
        CLOUDSDK_CONFIG="$HOME_GCLOUD_CONFIG"
        OPENMANAGER_GCLOUD_CONFIG_SOURCE="home"
        return 0
      fi

      local fallback_gcloud_dir="$CODEX_HOME/gcloud-config"
      if can_write_dir "$fallback_gcloud_dir"; then
        CLOUDSDK_CONFIG="$fallback_gcloud_dir"
        OPENMANAGER_GCLOUD_CONFIG_SOURCE="project-fallback"
        return 0
      fi
      ;;
  esac

  return 1
}

if ! choose_codex_home_from_mode "$OPENMANAGER_CODEX_HOME_MODE"; then
  echo "ERROR: Unable to resolve writable CODEX_HOME with config.toml"
  echo "mode=$OPENMANAGER_CODEX_HOME_MODE"
  echo "checked: $HOME_CODEX_HOME, $PROJECT_CODEX_HOME"
  return 2 2>/dev/null || exit 2
fi

if ! choose_gcloud_config_from_mode "$OPENMANAGER_GCLOUD_CONFIG_MODE"; then
  echo "ERROR: Unable to resolve writable CLOUDSDK_CONFIG"
  echo "mode=$OPENMANAGER_GCLOUD_CONFIG_MODE"
  echo "checked: ${CLOUDSDK_CONFIG:-<unset>}, $HOME_GCLOUD_CONFIG, $CODEX_HOME/gcloud-config"
  return 2 2>/dev/null || exit 2
fi

export CODEX_HOME
export CLOUDSDK_CONFIG
export OPENMANAGER_CODEX_HOME_SOURCE
export OPENMANAGER_GCLOUD_CONFIG_SOURCE

if [ "${1:-}" = "--print" ]; then
  printf 'OPENMANAGER_CODEX_HOME_MODE=%s\n' "$OPENMANAGER_CODEX_HOME_MODE"
  printf 'CODEX_HOME=%s\n' "$CODEX_HOME"
  printf 'CODEX_HOME_SOURCE=%s\n' "$OPENMANAGER_CODEX_HOME_SOURCE"
  printf 'OPENMANAGER_GCLOUD_CONFIG_MODE=%s\n' "$OPENMANAGER_GCLOUD_CONFIG_MODE"
  printf 'CLOUDSDK_CONFIG=%s\n' "$CLOUDSDK_CONFIG"
  printf 'CLOUDSDK_CONFIG_SOURCE=%s\n' "$OPENMANAGER_GCLOUD_CONFIG_SOURCE"
fi
