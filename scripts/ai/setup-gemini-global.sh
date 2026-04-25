#!/usr/bin/env bash
# Setup global Gemini CLI environment (~/.gemini/)
# Run once after cloning or on a new WSL instance.
#
# What this does:
#   1. Removes OpenManager project MCP entries from ~/.gemini/settings.json
#   2. Quarantines legacy ~/mcp_project_settings.json if it contains OpenManager MCP
#   3. Installs pinned local MCP package cache for fast stdio startup
#   4. Quarantines OpenManager user-scope skill copies from ~/.gemini/skills
#   5. Removes the obsolete OpenManager bootstrap marker if an older script added it

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
GEMINI_GLOBAL="$HOME/.gemini"
SETTINGS_FILE="$GEMINI_GLOBAL/settings.json"
PROJECT_SETTINGS_FILE="$PROJECT_DIR/.gemini/settings.json"
USER_SKILLS_DIR="$GEMINI_GLOBAL/skills"
GLOBAL_GEMINI_MD="$GEMINI_GLOBAL/GEMINI.md"
LEGACY_PROJECT_MCP_FILE="$HOME/mcp_project_settings.json"

mkdir -p "$GEMINI_GLOBAL"

echo "Project: $PROJECT_DIR"
echo "Global gemini dir: $GEMINI_GLOBAL"

# ── 1. Remove OpenManager MCP from user-scope settings ───────────────────────
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "{}" > "$SETTINGS_FILE"
fi

SETTINGS_FILE="$SETTINGS_FILE" PROJECT_SETTINGS_FILE="$PROJECT_SETTINGS_FILE" python3 - <<'PYEOF'
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

openmanager_servers = {
    "diagram-converter-mcp",
    "openmanager-ai-mcp",
    "supabase-db",
    "supabase",
    "playwright",
    "next-devtools",
    "chrome-devtools",
    "github",
    "vercel",
}

settings_path = Path(os.environ["SETTINGS_FILE"])
project_settings_path = Path(os.environ["PROJECT_SETTINGS_FILE"])
settings = json.loads(settings_path.read_text())
removed = []

servers = settings.get("mcpServers")
if isinstance(servers, dict):
    for name in sorted(openmanager_servers):
        if name in servers:
            removed.append(name)
            del servers[name]
    if not servers:
        settings.pop("mcpServers", None)

mcp = settings.get("mcp")
if isinstance(mcp, dict):
    allowed = mcp.get("allowed")
    if isinstance(allowed, list):
        mcp["allowed"] = [name for name in allowed if name not in openmanager_servers]
        if not mcp["allowed"]:
            mcp.pop("allowed", None)
    if not mcp:
        settings.pop("mcp", None)

if removed:
    backup_dir = settings_path.parent / "backups" / f"{datetime.now():%Y%m%d-%H%M%S}-project-mcp-scope-cleanup"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(settings_path, backup_dir / "settings.json.before-project-mcp-scope-cleanup")
    settings_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
    print(f"  removed OpenManager user-scope MCP entries: {', '.join(removed)}")
    print(f"  settings backup: {backup_dir}")
else:
    print("  user-scope OpenManager MCP entries: none to remove")

project_settings = json.loads(project_settings_path.read_text())
project_servers = sorted((project_settings.get("mcpServers") or {}).keys())
print(f"  project MCP servers: {len(project_servers)} ({', '.join(project_servers) or 'none'})")
PYEOF

# ── 2. Quarantine legacy home project MCP file ───────────────────────────────
LEGACY_PROJECT_MCP_FILE="$LEGACY_PROJECT_MCP_FILE" python3 - <<'PYEOF'
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

openmanager_servers = {
    "diagram-converter-mcp",
    "openmanager-ai-mcp",
    "supabase-db",
    "supabase",
    "playwright",
    "next-devtools",
    "chrome-devtools",
    "github",
    "vercel",
}

legacy_path = Path(os.environ["LEGACY_PROJECT_MCP_FILE"])
if not legacy_path.exists():
    print("  legacy ~/mcp_project_settings.json: not present")
else:
    try:
        settings = json.loads(legacy_path.read_text())
    except json.JSONDecodeError:
        print("  legacy ~/mcp_project_settings.json: present but not JSON; left unchanged")
    else:
        servers = set((settings.get("mcpServers") or {}).keys())
        if servers & openmanager_servers:
            backup_dir = legacy_path.parent / ".gemini" / "backups" / f"{datetime.now():%Y%m%d-%H%M%S}-legacy-project-mcp-file"
            backup_dir.mkdir(parents=True, exist_ok=True)
            target = backup_dir / legacy_path.name
            shutil.move(str(legacy_path), target)
            print(f"  quarantined legacy ~/mcp_project_settings.json: {target}")
        else:
            print("  legacy ~/mcp_project_settings.json: no OpenManager MCP; left unchanged")
PYEOF

# ── 3. MCP package cache ─────────────────────────────────────────────────────
if [ "${OPENMANAGER_SKIP_MCP_CACHE_INSTALL:-false}" = "true" ]; then
  echo "  MCP package cache install skipped"
else
  bash "$PROJECT_DIR/scripts/mcp/install-node-mcp-cache.sh"
fi

# ── 4. Quarantine user-scope OpenManager skills ──────────────────────────────
USER_SKILLS_DIR="$USER_SKILLS_DIR" PROJECT_DIR="$PROJECT_DIR" python3 - <<'PYEOF'
import os
import shutil
from datetime import datetime
from pathlib import Path

user_skills_dir = Path(os.environ["USER_SKILLS_DIR"])
project_dir = Path(os.environ["PROJECT_DIR"])
project_skills_dir = project_dir / ".agents" / "skills"

project_skill_names = {
    path.parent.name
    for path in project_skills_dir.glob("*/SKILL.md")
}

if not user_skills_dir.exists():
    print(f"  global Gemini skills: missing ({user_skills_dir})")
else:
    moved = []
    backup_dir = user_skills_dir.parent / f"skills.backup-openmanager-{datetime.now():%Y%m%d-%H%M%S}"
    for skill_name in sorted(project_skill_names):
        source = user_skills_dir / skill_name
        if (source / "SKILL.md").exists():
            backup_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), backup_dir / skill_name)
            moved.append(skill_name)

    if moved:
        print(f"  quarantined OpenManager user-scope skills: {', '.join(moved)}")
        print(f"  skills backup: {backup_dir}")
    else:
        print("  user-scope OpenManager skills: none to quarantine")

project_skill_count = len(project_skill_names)
print(f"  project shared skills: {project_skill_count} under {project_skills_dir}")
PYEOF

# ── 5. Remove stale managed bootstrap marker from older OpenManager script ───
if [ -f "$GLOBAL_GEMINI_MD" ]; then
  GLOBAL_GEMINI_MD="$GLOBAL_GEMINI_MD" python3 - <<'PYEOF'
import os
import shutil
from datetime import datetime
from pathlib import Path

path = Path(os.environ["GLOBAL_GEMINI_MD"])
start = "<!-- OPENMANAGER-BOOTSTRAP:START -->"
end = "<!-- OPENMANAGER-BOOTSTRAP:END -->"
content = path.read_text()

if start in content and end in content:
    backup_dir = path.parent / "backups" / f"{datetime.now():%Y%m%d-%H%M%S}-global-gemini-md-cleanup"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_dir / "GEMINI.md.before-openmanager-bootstrap-cleanup")
    before, rest = content.split(start, 1)
    _, after = rest.split(end, 1)
    path.write_text(before.rstrip() + "\n\n" + after.lstrip())
    print(f"  removed obsolete OpenManager bootstrap block from {path}")
    print(f"  GEMINI.md backup: {backup_dir}")
else:
    print("  global GEMINI.md: no obsolete OpenManager bootstrap block")
PYEOF
else
  echo "  global GEMINI.md: missing ($GLOBAL_GEMINI_MD)"
fi

echo ""
echo "Done. Restart Gemini CLI to apply changes."
