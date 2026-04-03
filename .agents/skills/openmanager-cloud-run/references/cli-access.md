# CLI Access Reference

## Install/version checks

```bash
gcloud --version | head -n 5
vercel --version
supabase --version
docker --version
```

## Auth source checks

```bash
# Inspect MCP env in local Codex config
sed -n '1,220p' .codex/config.toml
```

## Live access checks

```bash
# Google Cloud
gcloud auth list --filter=status:ACTIVE
gcloud config get-value project
gcloud auth application-default print-access-token
gcloud projects describe openmanager-free-tier --format='value(projectNumber)'

# Vercel
vercel whoami
vercel projects ls

# Supabase
supabase projects list

# Docker
docker ps
```

## Fast pass criteria

- gcloud active account visible
- gcloud project configured and `gcloud projects describe` succeeds
- ADC token command returns token
- vercel whoami returns account name and `vercel projects ls` succeeds
- supabase projects list returns at least one row or empty table without auth error

## Troubleshooting

### Sandbox/DNS failures

Symptoms: `lookup ... socket: operation not permitted`, `NameResolutionError`, `EAI_AGAIN`

Action: Rerun command with escalated permissions.

### GCloud writable config warning

Symptoms: `Could not setup log file ... Permission denied`

Action: Ensure `CLOUDSDK_CONFIG` points to writable directory.

### Token/auth failures

- Google Cloud: `gcloud auth login`, `gcloud auth application-default login`
- Vercel: refresh API key in config and retry `vercel whoami`
- Supabase: refresh personal access token and retry `supabase projects list`
