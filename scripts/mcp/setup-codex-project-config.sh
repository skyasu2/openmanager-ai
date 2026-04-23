#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/mcp/setup-codex-project-config.sh [--config <path>] [--dry-run]

What it does:
  1) Renders the tracked Codex project config template
  2) Replaces __REPO_ROOT__ / __HOME__ placeholders
  3) Writes .codex/config.toml with a timestamped backup when the file already exists
EOF
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_FILE="$REPO_ROOT/config/templates/codex.config.toml.template"
CONFIG_FILE="$REPO_ROOT/.codex/config.toml"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_FILE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
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

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "ERROR: template not found: $TEMPLATE_FILE" >&2
  exit 2
fi

mkdir -p "$(dirname "$CONFIG_FILE")"

rendered_file="$(mktemp)"
cleanup() {
  rm -f "$rendered_file"
}
trap cleanup EXIT

awk -v repo_root="$REPO_ROOT" -v home_dir="${HOME:-}" '
  {
    gsub(/__REPO_ROOT__/, repo_root)
    gsub(/__HOME__/, home_dir)
    print
  }
' "$TEMPLATE_FILE" > "$rendered_file"

if [[ -f "$CONFIG_FILE" ]] && cmp -s "$CONFIG_FILE" "$rendered_file"; then
  echo "No changes needed: $CONFIG_FILE already matches the tracked Codex project template."
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  diff_source="$CONFIG_FILE"
  if [[ ! -f "$CONFIG_FILE" ]]; then
    diff_source="/dev/null"
  fi
  echo "[Dry Run] Rendered Codex project config:"
  diff -u "$diff_source" "$rendered_file" || true
  exit 0
fi

if [[ -f "$CONFIG_FILE" ]]; then
  backup_file="${CONFIG_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$CONFIG_FILE" "$backup_file"
  echo "Backup: $backup_file"
fi

cp "$rendered_file" "$CONFIG_FILE"
echo "Wrote: $CONFIG_FILE"
echo "Next: bash scripts/mcp/codex-local.sh mcp list"
