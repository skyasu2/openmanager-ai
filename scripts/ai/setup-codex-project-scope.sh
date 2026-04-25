#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_SKILLS_DIR="$PROJECT_DIR/.agents/skills"
PROJECT_CODEX_SKILLS_DIR="$PROJECT_DIR/.codex/skills"
HOME_CODEX_DIR="${HOME:-}/.codex"
HOME_CODEX_SKILLS_DIR="$HOME_CODEX_DIR/skills"
HOME_CODEX_CONFIG="$HOME_CODEX_DIR/config.toml"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

OPENMANAGER_MCP_SERVERS=(
  supabase-db
  diagram-converter
  diagram-converter-mcp
  playwright
  next-devtools
  chrome-devtools
  github
  vercel
  supabase
  openmanager-ai-mcp
)

if [ ! -d "$PROJECT_SKILLS_DIR" ]; then
  echo "ERROR: project skills directory not found: $PROJECT_SKILLS_DIR" >&2
  exit 2
fi

mapfile -t PROJECT_SKILL_NAMES < <(
  find "$PROJECT_SKILLS_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md -type f \
    | sed "s#^$PROJECT_SKILLS_DIR/##; s#/SKILL.md##" \
    | sort
)

move_matching_skills() {
  local source_dir="$1"
  local backup_root="$2"
  local label="$3"
  local moved=0

  if [ ! -d "$source_dir" ]; then
    echo "  $label skills: missing ($source_dir)"
    return 0
  fi

  for skill_name in "${PROJECT_SKILL_NAMES[@]}"; do
    local source="$source_dir/$skill_name"
    if [ -f "$source/SKILL.md" ]; then
      mkdir -p "$backup_root/skills"
      mv "$source" "$backup_root/skills/$skill_name"
      moved=$((moved + 1))
    fi
  done

  if [ -f "$source_dir/.openmanager-managed-skills" ]; then
    mkdir -p "$backup_root/skills"
    mv "$source_dir/.openmanager-managed-skills" "$backup_root/skills/.openmanager-managed-skills"
  fi

  if [ "$moved" -eq 0 ]; then
    echo "  $label OpenManager skill copies: none"
  else
    echo "  $label OpenManager skill copies quarantined: $moved -> $backup_root/skills"
  fi
}

filter_openmanager_mcp_sections() {
  local source_file="$1"
  local target_file="$2"
  local excluded_servers="${OPENMANAGER_MCP_SERVERS[*]}"

  awk -v excluded_servers="$excluded_servers" '
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
    /^\[/ {
      if (is_excluded_section($0)) {
        skip = 1
        next
      }
      skip = 0
    }
    !skip {
      print
    }
  ' "$source_file" > "$target_file"
}

clean_home_codex_mcp() {
  if [ ! -f "$HOME_CODEX_CONFIG" ]; then
    echo "  home Codex config: missing ($HOME_CODEX_CONFIG)"
    return 0
  fi

  local has_openmanager_mcp=0
  for server in "${OPENMANAGER_MCP_SERVERS[@]}"; do
    if grep -Fq "[mcp_servers.$server]" "$HOME_CODEX_CONFIG"; then
      has_openmanager_mcp=1
      break
    fi
  done

  if [ "$has_openmanager_mcp" -eq 0 ]; then
    echo "  home Codex MCP entries: none"
    return 0
  fi

  local backup_root="$HOME_CODEX_DIR/backups/$TIMESTAMP-openmanager-project-scope"
  local filtered_file
  filtered_file="$(mktemp)"
  mkdir -p "$backup_root"
  cp "$HOME_CODEX_CONFIG" "$backup_root/config.toml.before-openmanager-mcp-cleanup"
  filter_openmanager_mcp_sections "$HOME_CODEX_CONFIG" "$filtered_file"
  mv "$filtered_file" "$HOME_CODEX_CONFIG"
  echo "  home Codex MCP entries removed; backup: $backup_root"
}

echo "Project: $PROJECT_DIR"
echo "Codex project skill source: $PROJECT_SKILLS_DIR"

clean_home_codex_mcp
move_matching_skills \
  "$HOME_CODEX_SKILLS_DIR" \
  "$HOME_CODEX_DIR/backups/$TIMESTAMP-openmanager-project-scope" \
  "home Codex"
move_matching_skills \
  "$PROJECT_CODEX_SKILLS_DIR" \
  "$PROJECT_DIR/.codex/backups/$TIMESTAMP-openmanager-project-scope" \
  "project .codex"

echo ""
echo "Done. Validate with:"
echo "  npm run codex:check"
echo "  npm run skills:check"
