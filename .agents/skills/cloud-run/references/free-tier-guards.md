# Free Tier Guards

## Required checks

Run these checks before deployment:

```bash
rg -n "machineType|--machine-type|E2_HIGHCPU_8|N1_HIGHCPU_8" cloud-run/ai-engine/deploy.sh cloud-run/ai-engine/cloudbuild.yaml
```

## Pass criteria

- `deploy.sh` must not include `--machine-type`
- `cloudbuild.yaml` must not include `machineType`
- no highcpu presets (`E2_HIGHCPU_8`, `N1_HIGHCPU_8`)

## Runtime bounds

Target values for `ai-engine`:

- `--cpu 1`
- `--memory 512Mi`
- `--max-instances 1`
- `--cpu-throttling` enabled

## Stop conditions

If any paid-machine setting appears, stop deployment and request a fix.
