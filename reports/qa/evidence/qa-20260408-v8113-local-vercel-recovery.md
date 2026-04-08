# QA Evidence - v8.11.3 Production Recovered via Local Vercel Deploy

- Recorded at: 2026-04-08 23:35 KST
- Recovery method: local `npx vercel --prod --yes`
- Recovery deployment ID: dpl_A3VtpXaxdPvTZYe4t98wRdMVenWz
- Recovery deployment URL: https://openmanager-az99i79wb-skyasus-projects.vercel.app

## Production Verification

Command:

```bash
node scripts/test/vercel-post-deploy-smoke.mjs --url=https://openmanager-ai.vercel.app --retries=0 --expected-version=8.11.3
```

Result:

- `GET /` PASS
- `GET /validation` PASS
- `GET /api/version` PASS

## Deployment State

Command:

```bash
npx vercel inspect https://openmanager-ai.vercel.app
```

Result summary:

- active production deployment: `dpl_A3VtpXaxdPvTZYe4t98wRdMVenWz`
- target: `production`
- status: `Ready`
- alias includes `https://openmanager-ai.vercel.app`

## Remaining Gap

- Production has been recovered.
- Canonical GitLab semver tag deploy path is still blocked until protected tag / variable exposure is fixed.
- The remaining open item is `gitlab-tag-protected-variable-exposure-v8113`.
