# Verification

## Commands

```bash
SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format 'value(status.url)')
curl -s "${SERVICE_URL}/health"
curl -s "${SERVICE_URL}/monitoring"
```

## Expected minimum

- `/health` returns status payload indicating service is healthy
- `/monitoring` responds without server error

## If verification fails

1. Wait 10-20 seconds, retry once.
2. Check latest Cloud Run revision logs.
3. If regression is clear, run rollback steps.
