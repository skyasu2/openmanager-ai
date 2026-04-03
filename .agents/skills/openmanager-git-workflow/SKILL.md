---
name: openmanager-git-workflow
description: Safe git commit, push, and PR workflow for OpenManager with conventional commits, non-destructive rules, and MCP-first PR creation. Use when user asks to commit, push, open PR, or sync branch.
version: v1.3.0
user-invocable: true
---

# OpenManager Git Workflow

Use a deterministic commit/push/PR flow with safety checks.

## Current topology (2026-04-03)

- `gitlab` remote: canonical private repo, full history/tests/docs/QA assets, release/tag authority
- `origin` remote: public GitHub code-only snapshot with minimal public-only history
- Vercel frontend deploy source: `gitlab` `main`
- GitLab CI policy: active split-runner delivery
- Exact job names/rules live in `.gitlab-ci.yml`; do not hardcode them in a commit message or review unless you re-read that file first.
- Current stable shape:
  - canonical validation runs on self-hosted `wsl2-docker`
  - frontend production deploy runs on GitLab.com shared runner via `vercel build --prod` + `vercel deploy --prebuilt --prod`
  - production deploy uses serialized execution (`resource_group: production`)
  - post-deploy smoke and ai-engine validation/deploy paths may evolve independently
- GitHub public repo: no releases/tags, issues/wiki/projects disabled, not a deployment control plane

Never assume `origin/main` is the canonical branch. Always inspect `git remote -v` before any push/fetch/rebase.

## Execute this workflow

### Workflow A: Commit

1. Inspect working tree.
- `git status --short`
- `git diff --cached --stat`
- If no staged changes, stop and ask for file selection.

2. Validate remote topology first.
- `git remote -v`
- Confirm `gitlab` exists and remains the canonical push target for private development work.
- Only validate GitHub auth when the user explicitly wants GitHub public sync or GitHub PR work.
- `env -u GITHUB_PERSONAL_ACCESS_TOKEN gh auth status -h github.com`
- `env -u GITHUB_PERSONAL_ACCESS_TOKEN gh api user -q .login`
- If a GitHub remote is HTTPS, switch that remote to SSH.

3. Stage only requested files.
- Use explicit `git add <file...>`.
- Avoid broad staging when scope is unclear.

4. Verify before commit.
- Run `npm run test:quick` when code changed.
- Run `npm run test:contract` when the change can alter request/response behavior:
  - `src/app/api/**`
  - `src/lib/ai/**`
  - auth/session/env wiring
  - QA/deploy scripts or config that affect runtime routing
- Run targeted checks for changed areas when needed.
- If user asked for "review", run `$openmanager-code-review` first and resolve/acknowledge findings before commit.

5. Create conventional commit.
- Format: `<type>(scope): <summary>`
- Common types: `feat`, `fix`, `refactor`, `docs`, `chore`

6. Report commit result.
- Commit hash, branch, message, changed file count.

### Workflow B: Push & PR

1. Verify remote topology first.
- `git remote -v`
- Default push target for canonical work: `gitlab`
- Treat GitHub `origin` as public snapshot only
- Validate GitHub auth only when GitHub work is explicitly requested.
- `env -u GITHUB_PERSONAL_ACCESS_TOKEN gh auth status -h github.com`
- `env -u GITHUB_PERSONAL_ACCESS_TOKEN gh api user -q .login`

2. Inspect current branch and diff scope.
- `git status --short`
- `git branch --show-current`
- `git log --oneline --decorate -n 5`

3. Verify commit readiness.
- Ensure intended files only.
- If code changed, run `npm run test:quick` or targeted checks.
- Add `npm run test:contract` when API, auth, env, proxy, or deploy-facing behavior changed.
- Prefer local Docker CI when changes are broad or deployment-sensitive: `npm run ci:local:docker`
- For high-risk changes or explicit review requests, run `$openmanager-code-review` and include key findings/residual risks in PR body.

4. Push safely.
- Canonical/private work: `git push gitlab <branch>`
- If upstream missing on GitLab: `git push -u gitlab <branch>`
- GitHub `origin` push is only for explicit public snapshot sync via `npm run sync:github`.
- Never force-push the public snapshot from the canonical private worktree.

5. Create PR when requested.
- Canonical/private work: push branch to `gitlab`, then open a GitLab Merge Request manually in the GitLab UI.
- GitHub MCP (`create_pull_request`) is not part of the routine delivery path for this repo. Use it only when the task explicitly targets the public snapshot repository itself.
- CLI fallback: `gh pr create` only when the task explicitly targets GitHub and MCP is unavailable.
- Include concise title/body with changed scope and risks.

### Workflow D: Canonical deploy + public refresh

1. Validate locally (`pre-push`, targeted tests, or `npm run ci:local:docker` as needed).
2. Push canonical change: `git push gitlab main`
3. Treat GitLab CI status as the deployment authority; inspect the current `.gitlab-ci.yml` pipeline rather than relying on stale memory.
4. If a release/tag was created: `git push gitlab --follow-tags`
5. Refresh public code repo only when needed: `npm run sync:github`
6. Do not treat GitHub as deployment status, release authority, or issue tracker.

7. Verify remote state.
- `git fetch gitlab`
- `git status -sb`
- If PR created, report URL and check status.

### Workflow C: Commit → Push → PR (one-shot)

1. Execute Workflow A (Commit).
2. Execute Workflow B (Push & PR).
3. Report combined results.

## Safety rules

- Do not use interactive git UI.
- Do not amend existing commits unless explicitly requested.
- Do not use `git reset --hard`, `git checkout --`, or force push unless explicitly requested.
- Do not revert others' unrelated changes.
- Stop and ask when unexpected changes or conflicts appear in active scope.
- Do not mix shell-exported GitHub token and stored `gh` credentials in the same flow.
- Do not use `git push origin` as a default habit in this repo. Confirm whether the task targets `gitlab` (canonical) or GitHub public snapshot first.

## References

- `references/message-patterns.md`
- `references/pre-push-checks.md`
- `references/pr-template.md`
- `references/failure-recovery.md`
- `https://cli.github.com/manual/gh_auth_login`
