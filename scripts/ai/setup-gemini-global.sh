#!/usr/bin/env bash
# Setup global Gemini CLI environment (~/.gemini/)
# Run once after cloning or on a new WSL instance.
#
# What this does:
#   1. Removes legacy OpenManager user-scope MCP duplicates from ~/.gemini/settings.json
#   2. Installs pinned local MCP package cache for fast stdio startup
#   3. Leaves skills repo-scoped under .agents/skills/ to avoid duplicate discovery
#   4. Creates ~/GEMINI.md symlink → project GEMINI.md

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
GEMINI_GLOBAL="$HOME/.gemini"

echo "Project: $PROJECT_DIR"
echo "Global gemini dir: $GEMINI_GLOBAL"

# ── 1. Remove legacy user-scope MCP duplicates ───────────────────────────────
SETTINGS_FILE="$GEMINI_GLOBAL/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "{}" > "$SETTINGS_FILE"
fi

python3 - <<PYEOF
import json

settings_path = "$SETTINGS_FILE"
with open(settings_path) as f:
    settings = json.load(f)

openmanager_servers = {
    "diagram-converter-mcp",
    "supabase-db",
    "playwright",
    "next-devtools",
    "chrome-devtools",
    "github",
    "vercel",
}

servers = settings.get("mcpServers")
if isinstance(servers, dict):
    for name in openmanager_servers:
        servers.pop(name, None)
    if not servers:
        settings.pop("mcpServers", None)

mcp = settings.get("mcp")
if isinstance(mcp, dict) and set(mcp.get("allowed", [])) == openmanager_servers:
    mcp.pop("allowed", None)
    if not mcp:
        settings.pop("mcp", None)

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("  legacy OpenManager user-scope MCP entries removed from", settings_path)
PYEOF

# ── 2. MCP package cache ─────────────────────────────────────────────────────
if [ "${OPENMANAGER_SKIP_MCP_CACHE_INSTALL:-false}" = "true" ]; then
  echo "  MCP package cache install skipped"
else
  bash "$PROJECT_DIR/scripts/mcp/install-node-mcp-cache.sh"
fi

# ── 3. Skills ────────────────────────────────────────────────────────────────
echo "  skills: using repo-scoped .agents/skills/ (no ~/.gemini/skills symlinks)"

# ── 4. ~/GEMINI.md symlink ────────────────────────────────────────────────────
GEMINI_MD="$HOME/GEMINI.md"
TARGET_MD="$PROJECT_DIR/GEMINI.md"
if [ -L "$GEMINI_MD" ]; then
  echo "  ~/GEMINI.md already linked — skipping"
elif [ -e "$GEMINI_MD" ]; then
  echo "  WARN: ~/GEMINI.md exists but is not a symlink — skipping"
else
  ln -sf "$TARGET_MD" "$GEMINI_MD"
  echo "  ✓ ~/GEMINI.md → $TARGET_MD"
fi

echo ""
echo "Done. Restart Gemini CLI to apply changes."
