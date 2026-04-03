# Cost Check Reference

## Commands

### Auth and project

```bash
gcloud auth list
gcloud config get-value project
```

### Cloud Build machine check

```bash
gcloud builds list --limit=30 --format="table(id.slice(0:8),status,createTime.date(),options.machineType)"
gcloud builds list --limit=200 --format=json > /tmp/gcp-builds.json
```

### Cloud Run limits check

```bash
gcloud run services describe ai-engine --region asia-northeast1 --format="value(spec.template.spec.containers[0].resources.limits)"
```

## Interpretation

### Cloud Build

Treat these as cost warning signals:

- `options.machineType` explicitly set
- values like `E2_HIGHCPU_8`, `N1_HIGHCPU_8`

Default/empty machine type is preferred for free-tier behavior.

### Cloud Run

Expected baseline:

- CPU: `1`
- Memory: `512Mi`

Values above this baseline increase cost risk and should be reviewed.

### Final status

- `FREE_TIER_OK`: no paid-machine signals and runtime within baseline
- `COST_WARNING`: one or more paid/cost-risk signals detected

## Remediation

### If Cloud Build paid machine is detected

1. Remove `machineType` from `cloud-run/ai-engine/cloudbuild.yaml`.
2. Remove `--machine-type` from `cloud-run/ai-engine/deploy.sh`.
3. Re-run cost check.

### If Cloud Run limits exceed baseline

1. Update deploy args to: `--cpu 1`, `--memory 512Mi`, `--max-instances 1`
2. Redeploy and re-check service config.

### If auth fails

1. Refresh credentials (`gcloud auth login` / `gcloud auth application-default login`).
2. Re-run checks.
