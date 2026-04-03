# Rollback

## Quick rollback

List recent revisions:

```bash
gcloud run revisions list --service ai-engine --region asia-northeast1 --limit 5
```

Shift traffic to known good revision:

```bash
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-revisions REVISION_NAME=100
```

Re-run health verification after rollback.

## Restore latest

```bash
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-latest
```
