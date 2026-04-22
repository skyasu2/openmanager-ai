#!/usr/bin/env bash
# Setup global Gemini CLI environment (~/.gemini/)
# Run once after cloning or on a new WSL instance.
#
# What this does:
#   1. Adds mcpServers to ~/.gemini/settings.json (preserves existing auth/ui/model keys)
#   2. Creates ~/.gemini/skills/ symlinks → project .claude/skills/
#   3. Creates ~/GEMINI.md symlink → project GEMINI.md

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
GEMINI_GLOBAL="$HOME/.gemini"
CLAUDE_SKILLS="$PROJECT_DIR/.claude/skills"

echo "Project: $PROJECT_DIR"
echo "Global gemini dir: $GEMINI_GLOBAL"

# ── 1. mcpServers in ~/.gemini/settings.json ──────────────────────────────────
SETTINGS_FILE="$GEMINI_GLOBAL/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "{}" > "$SETTINGS_FILE"
fi

# Check if mcpServers already present
if python3 -c "import json,sys; d=json.load(open('$SETTINGS_FILE')); sys.exit(0 if 'mcpServers' in d else 1)" 2>/dev/null; then
  echo "  mcpServers already in $SETTINGS_FILE — skipping"
else
  python3 - <<PYEOF
import json

settings_path = "$SETTINGS_FILE"
with open(settings_path) as f:
    settings = json.load(f)

settings["mcpServers"] = {
    "diagram-converter-mcp": {
        "command": "npx",
        "args": ["-y", "diagram-converter-mcp@latest"]
    },
    "supabase-db": {
        "command": "node",
        "args": ["/home/sky-note/.mcp-servers/supabase/node_modules/@supabase/mcp-server-supabase/dist/transports/stdio.js"],
        "env": {"SUPABASE_ACCESS_TOKEN": "\${SUPABASE_ACCESS_TOKEN}"}
    },
    "playwright": {
        "command": "npx",
        "args": ["-y", "@playwright/mcp",
                 "--user-data-dir", "/home/sky-note/.playwright-mcp/gemini-profile",
                 "--output-dir", "/home/sky-note/.playwright-mcp/screenshots"],
        "env": {"DISPLAY": ":0"}
    },
    "next-devtools": {
        "command": "npx",
        "args": ["-y", "next-devtools-mcp@latest"]
    },
    "chrome-devtools": {
        "command": "npx",
        "args": ["-y", "chrome-devtools-mcp@latest", "--isolated", "--headless"],
        "env": {"DISPLAY": ":0"}
    },
    "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "\${GITHUB_PERSONAL_ACCESS_TOKEN}"}
    },
    "vercel": {
        "command": "bash",
        "args": ["-lc", "npx -y vercel-mcp \"VERCEL_API_KEY=\$VERCEL_API_KEY\""],
        "env": {"VERCEL_API_KEY": "\${VERCEL_API_KEY}"}
    }
}

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("  mcpServers added to", settings_path)
PYEOF
fi

# ── 2. ~/.gemini/skills/ symlinks ─────────────────────────────────────────────
SKILLS_DIR="$GEMINI_GLOBAL/skills"
mkdir -p "$SKILLS_DIR"

skills=(cloud-run code-review doc-management env-sync git-clean-gone git-workflow lint-smoke qa-ops qa-state state-triage)
for skill in "${skills[@]}"; do
  target="$CLAUDE_SKILLS/$skill"
  link="$SKILLS_DIR/$skill"
  if [ -L "$link" ]; then
    echo "  skills/$skill already linked — skipping"
  elif [ -e "$link" ]; then
    echo "  WARN: $link exists but is not a symlink — skipping"
  else
    ln -sf "$target" "$link"
    echo "  ✓ skills/$skill → $target"
  fi
done

# ── 3. ~/GEMINI.md symlink ────────────────────────────────────────────────────
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
