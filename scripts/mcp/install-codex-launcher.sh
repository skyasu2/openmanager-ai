#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CODEX_LOCAL_RUNNER="$REPO_ROOT/scripts/mcp/codex-local.sh"
INSTALL_DIR="${OPENMANAGER_CODEX_LAUNCHER_DIR:-${HOME:-}/.local/bin}"
LAUNCHER_NAME="openmanager-codex"
FORCE=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/mcp/install-codex-launcher.sh [--name <command>] [--dir <path>] [--force]

Examples:
  npm run codex:install-launcher
  npm run codex:install-launcher:shadow

What it does:
  Installs a small user-level launcher that starts Codex through
  scripts/mcp/codex-local.sh, so project .env.local is loaded before MCP startup.

Notes:
  - The default command is openmanager-codex.
  - Use --name codex only when you want ~/.local/bin/codex to shadow the global
    Codex binary for shells where ~/.local/bin appears earlier in PATH.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      LAUNCHER_NAME="${2:-}"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$LAUNCHER_NAME" || ! "$LAUNCHER_NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "ERROR: invalid launcher name: ${LAUNCHER_NAME:-<empty>}" >&2
  exit 2
fi

if [[ -z "$INSTALL_DIR" ]]; then
  echo "ERROR: HOME is not set and --dir was not provided" >&2
  exit 2
fi

if [[ ! -x "$CODEX_LOCAL_RUNNER" ]]; then
  echo "ERROR: project Codex runner is not executable: $CODEX_LOCAL_RUNNER" >&2
  exit 2
fi

is_openmanager_launcher() {
  local candidate="$1"
  [[ -f "$candidate" ]] && grep -q 'OPENMANAGER_CODEX_LAUNCHER=1' "$candidate" 2>/dev/null
}

resolve_real_codex_bin() {
  local target_path="$1"
  local candidate=""

  if [[ -n "${OPENMANAGER_REAL_CODEX_BIN:-}" ]]; then
    if [[ -x "$OPENMANAGER_REAL_CODEX_BIN" ]]; then
      printf '%s\n' "$OPENMANAGER_REAL_CODEX_BIN"
      return 0
    fi
    echo "ERROR: OPENMANAGER_REAL_CODEX_BIN is not executable: $OPENMANAGER_REAL_CODEX_BIN" >&2
    return 2
  fi

  while IFS= read -r candidate; do
    if [[ -z "$candidate" || "$candidate" == "$target_path" ]]; then
      continue
    fi
    if is_openmanager_launcher "$candidate"; then
      continue
    fi

    printf '%s\n' "$candidate"
    return 0
  done < <(type -P -a codex 2>/dev/null || true)

  echo "ERROR: unable to find the real codex binary in PATH" >&2
  echo "Hint: set OPENMANAGER_REAL_CODEX_BIN=/path/to/codex and rerun." >&2
  return 2
}

mkdir -p "$INSTALL_DIR"

TARGET_PATH="$INSTALL_DIR/$LAUNCHER_NAME"
REAL_CODEX_BIN="$(resolve_real_codex_bin "$TARGET_PATH")"

if [[ -e "$TARGET_PATH" ]] && ! is_openmanager_launcher "$TARGET_PATH" && [[ "$FORCE" -ne 1 ]]; then
  echo "ERROR: refusing to overwrite existing file: $TARGET_PATH" >&2
  echo "Hint: pass --force only after verifying that file is safe to replace." >&2
  exit 2
fi

TMP_PATH="$(mktemp "${TMPDIR:-/tmp}/openmanager-codex-launcher.XXXXXX")"
cleanup() {
  rm -f "$TMP_PATH"
}
trap cleanup EXIT

{
  printf '%s\n' '#!/usr/bin/env bash'
  printf '%s\n' 'set -euo pipefail'
  printf '%s\n' '# OPENMANAGER_CODEX_LAUNCHER=1'
  printf 'export OPENMANAGER_REAL_CODEX_BIN=%q\n' "$REAL_CODEX_BIN"
  printf 'OPENMANAGER_REPO_ROOT=%q\n' "$REPO_ROOT"
  printf '%s\n' 'CURRENT_DIR="$(pwd -P)"'
  printf '%s\n' 'case "$CURRENT_DIR/" in'
  printf '%s\n' '  "$OPENMANAGER_REPO_ROOT"/*)'
  printf '    exec bash %q "$@"\n' "$CODEX_LOCAL_RUNNER"
  printf '%s\n' '    ;;'
  printf '%s\n' '  *)'
  printf '%s\n' '    exec "$OPENMANAGER_REAL_CODEX_BIN" "$@"'
  printf '%s\n' '    ;;'
  printf '%s\n' 'esac'
} > "$TMP_PATH"

chmod 0755 "$TMP_PATH"
mv "$TMP_PATH" "$TARGET_PATH"
trap - EXIT

echo "Installed: $TARGET_PATH"
echo "Real Codex: $REAL_CODEX_BIN"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "WARN: $INSTALL_DIR is not in PATH for this shell."
elif [[ "$(command -v "$LAUNCHER_NAME" 2>/dev/null || true)" != "$TARGET_PATH" ]]; then
  echo "WARN: $LAUNCHER_NAME does not resolve to $TARGET_PATH yet; check PATH order."
fi
