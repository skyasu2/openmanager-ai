---
name: openmanager-cloud-run
description: Deploy ai-engine to Cloud Run, check GCP cost risk, and verify CLI access. Combines deployment, free-tier guards, cost inspection, and CLI connectivity checks. Use when user asks to deploy, check billing, verify cloud access, or review cost status.
version: v1.0.0
user-invocable: true
---

# OpenManager Cloud Run

Deploy, cost-check, and CLI-access verification for Cloud Run ai-engine.

## Execute this workflow

### Workflow A: Deploy

1. Run preflight checks.
- `git status --short`
- `gcloud config get-value project`
- `cd cloud-run/ai-engine && npm run type-check`
- `test -f public/data/otel-data/resource-catalog.json` (런타임 SSOT 존재 확인)
- Docker readiness:
  - WSL: `docker ps`
  - If WSL socket unavailable, fallback: `cmd.exe /c docker ps`

2. Build local Docker image before deploy.
- `cd cloud-run/ai-engine && npm run docker:preflight`
- Build-only mode: `cd cloud-run/ai-engine && SKIP_RUN=true npm run docker:preflight`
- If build fails, stop deployment and fix root cause first.

3. Enforce free-tier guard rules before deploy.
- `rg -n "machineType|--machine-type|E2_HIGHCPU_8|N1_HIGHCPU_8" cloud-run/ai-engine/deploy.sh cloud-run/ai-engine/cloudbuild.yaml`
- If custom machine settings are present, stop and fix before deployment.

4. Deploy.
- `cd cloud-run/ai-engine && bash deploy.sh`

5. Verify service health.
- `SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format 'value(status.url)')`
- `curl -s "${SERVICE_URL}/health"`
- `curl -s "${SERVICE_URL}/monitoring"` (인증 없으면 401/403 예상)
- If API key is available: `curl -s -H "Authorization: Bearer ${CLOUD_RUN_API_KEY}" "${SERVICE_URL}/monitoring"`

6. Report result.
- project id, deployed service URL, health check result
- local docker prebuild result, guard check result
- monitoring endpoint auth status (unauth expected / auth validated)
- rollback command if needed

### Workflow B: Cost Check

1. Confirm auth and project.
- `gcloud auth list`
- `gcloud config get-value project`

2. Inspect recent Cloud Build machine settings.
- `gcloud builds list --limit=30 --format="table(id.slice(0:8),status,createTime.date(),options.machineType)"`
- Flag any explicit machine type other than default.

3. Detect paid-machine signatures.
- `gcloud builds list --limit=200 --format=json > /tmp/gcp-builds.json`
- Parse for `E2_HIGHCPU_8`, `N1_HIGHCPU_8`, or non-empty `options.machineType`.

4. Inspect Cloud Run live limits.
- `gcloud run services describe ai-engine --region asia-northeast1 --format="value(spec.template.spec.containers[0].resources.limits)"`
- Check CPU/memory against expected baseline (1 CPU, 512Mi).

5. Classify status.
- `FREE_TIER_OK`: no paid-machine usage, runtime within bounds.
- `COST_WARNING`: paid-machine traces or oversized runtime limits.

6. Report with concrete actions.
- commands to remediate, whether deployment should be blocked.

### Workflow C: CLI Access Check

1. Verify CLI binaries exist.
- `gcloud --version`, `vercel --version`, `supabase --version`, `docker --version`

2. Verify auth source.
- Read `.codex/config.toml` MCP env sections.
- Confirm required keys/paths exist.

3. Run connectivity checks.
- GCP:
  - `gcloud auth list`
  - `gcloud config get-value project`
  - `gcloud auth application-default print-access-token`
  - `gcloud projects describe <project-id> --format='value(projectNumber)'`
- Vercel:
  - `vercel whoami`
  - `vercel projects ls`
- Supabase: `supabase projects list`
- Docker daemon: `docker ps`

4. Report with action items.
- installation: ok/fail, auth source: ok/missing, live access: ok/fail

## Failure handling

- If Docker daemon/socket is unavailable: start Docker Desktop and retry.
- If local Docker build fails with lock mismatch: sync lockfile and retry.
- If sandbox blocks DNS/network/auth (`NameResolutionError`, `EAI_AGAIN`), rerun with escalated permissions.
- If deploy succeeds but health fails, wait 10-20s and retry once.
- If service regression is confirmed, follow `references/rollback.md`.
- If CLI commands fail due to project not set, stop and request selection.

## Output format

### Deploy
```text
Cloud Run Deploy Results
- project: <id>
- service URL: <url>
- health: ok|fail
- monitoring: ok|fail
- cost guard: pass|warn
- rollback: gcloud run services update-traffic ...
```

### Cost Check
```text
GCP Cost Check Results
- project: <id>
- cloud build paid-signal: yes|no
- cloud run limits: <value>
- status: FREE_TIER_OK|COST_WARNING
- next action: <one line>
```

### CLI Access
```text
Cloud CLI Access Summary
- GCP: install ok | auth ok | live access ok/fail
- Vercel: install ok | auth ok | live access ok/fail
- Supabase: install ok | auth ok | live access ok/fail
- Blockers: <none | list>
- Next actions: <commands>
```

## References

- `references/free-tier-guards.md`
- `references/verification.md`
- `references/rollback.md`
- `references/cost-check.md`
- `references/cli-access.md`
