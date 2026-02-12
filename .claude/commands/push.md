---
description: Push local commits to GitHub (CLI first, MCP fallback)
---

## Context

- Current git status: $GIT_STATUS
- Current branch: $GIT_BRANCH
- Recent commits: $GIT_LOG

## Your task

Push all unpushed local commits to the remote repository.

### Workflow

1. **Check unpushed commits**:
   ```bash
   git log origin/$GIT_BRANCH..HEAD --oneline
   ```
   If no unpushed commits, say "Nothing to push." and stop.

2. **Show changed files**:
   ```bash
   git diff origin/$GIT_BRANCH..HEAD --stat
   ```

3. **Push via CLI with PAT** (fast path, supports file deletion):
   ```bash
   # Read PAT from .env.local
   PAT=$(grep GITHUB_TOKEN .env.local | head -1 | cut -d= -f2)
   git push https://skyasu2:${PAT}@github.com/skyasu2/openmanager-ai.git $GIT_BRANCH
   ```
   This method handles all git operations including file deletions.

4. **If CLI fails**: Fall back to GitHub MCP.
   - Read each changed file with the Read tool
   - Use `mcp__github__push_files` with:
     - owner: `skyasu2`
     - repo: `openmanager-ai`
     - branch: current branch
     - files: `[{path, content}]` array
     - message: latest commit message
   - If >20 files, batch in groups of 20
   - After MCP push, sync local: `git fetch origin && git reset --soft origin/$GIT_BRANCH`
   - **Note**: MCP cannot delete files. If deletions exist, warn user and suggest CLI with PAT.

5. **Verify and report**:
   ```
   Push Results
   - Branch: <branch>
   - Commits: N개 pushed
   - Method: CLI / MCP
   - Status: Success / Failed
   ```

You have the capability to call multiple tools in a single response. Do not use any other tools or do anything else besides the push workflow. Do not send any other text or messages besides these tool calls.
