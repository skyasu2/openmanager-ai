# QA Evidence - v8.11.4 Canonical Release Success

- Recorded at: 2026-04-09 01:52 KST
- Target release tag: v8.11.4
- Target release commit: 8ca2b7eb55c67fb21835f4fe4842b2dcb2fd2854
- Active production deployment ID: dpl_FnzN8yJFRkS5TUkvQYWREJwtJGh2
- Active production deployment URL: https://openmanager-d30ys163z-skyasus-projects.vercel.app

## Production Verification

Command:

```bash
node scripts/test/vercel-post-deploy-smoke.mjs --url=https://openmanager-ai.vercel.app --retries=0 --expected-version=8.11.4
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

- active production deployment: `dpl_FnzN8yJFRkS5TUkvQYWREJwtJGh2`
- target: `production`
- status: `Ready`
- alias includes `https://openmanager-ai.vercel.app`

## Interpretation

- GitLab protected tag / protected variable exposure issue has been resolved.
- Canonical semver release path produced a healthy production deployment for `v8.11.4`.
- The previous blocker `gitlab-tag-protected-variable-exposure-v8113` can be closed.
