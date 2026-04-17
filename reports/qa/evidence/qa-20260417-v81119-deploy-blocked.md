# QA Evidence - v8.11.19 Deploy Verification Blocked

- Recorded at: 2026-04-17 14:19:42 KST
- Target release commit: d9e9f45377c439ddc3f7031ad23c8b991f3cd4ec
- Target tag: v8.11.19
- Production URL: https://openmanager-ai.vercel.app
- Active production deployment ID: dpl_7g1jwikybsmVbh2u8SgHDoGhTfPr
- Active production deployment URL: https://openmanager-8hf9l88i7-skyasus-projects.vercel.app
- Active production commit: 167417d50c14ec3ff25fe57714fd1611c7800ed6
- Active production release: 8.11.18

## Release Push Result

- `git push --follow-tags gitlab main` succeeded.
- `git ls-remote --heads --tags gitlab | rg 'refs/(heads/main|tags/v8\\.11\\.19)$'` confirmed:
  - `refs/heads/main` -> `73d53899c5bb8dfe71c4709f5dd864087a036410`
  - `refs/tags/v8.11.19` present on `gitlab`

## Smoke Result

Command:

```bash
node scripts/test/vercel-post-deploy-smoke.mjs --url=https://openmanager-ai.vercel.app --expected-version=8.11.19 --timeout-ms=8000 --retries=80 --retry-delay-ms=15000
```

Observed result before stopping further investigation:

- `GET /` PASS
- `GET /validation` PASS
- `GET /api/version` FAIL
- repeated through at least attempt `22/81`
- failure message: `expected deployed version 8.11.19, got 8.11.18`

Direct check at `2026-04-17 14:18:56 KST`:

```json
{"version":"8.11.18","buildVersion":"8.11.18","nextjs":"16.1.6","environment":"production","timestamp":"2026-04-17T05:18:56.073Z"}
```

## Vercel Deployment Evidence

Vercel deployment history was checked via connector and CLI.

- Latest production deployment is still `dpl_7g1jwikybsmVbh2u8SgHDoGhTfPr`
- Created at `2026-04-17 13:37:22 KST`
- Commit metadata points to `167417d50c14ec3ff25fe57714fd1611c7800ed6`
- Commit message: `chore(release): 8.11.18`
- No `v8.11.19` production deployment was observed after the release tag push

Interpretation:

- Canonical release commit and tag were created and pushed successfully.
- Production still aliases the previous `8.11.18` deployment.
- Based on the repository deploy topology, the next check point is the GitLab semver tag pipeline for `v8.11.19`.
- This is an inference from repository configuration and Vercel state. The GitLab pipeline itself could not be inspected directly from this environment.

## Targeted QA Impact

- The planned Active Task was `active alerts modal AI prefill server-name normalization deploy + targeted production recheck`.
- That targeted production recheck is blocked until production actually serves `8.11.19`.
- No new product-surface regression claim is made here; this record only captures release verification blockage.

## Vercel Usage Check

Command:

```bash
npm run check:usage:vercel
```

Result summary:

- billing period: `2026-04-01T07:00:00.000Z..2026-04-17T05:19:28.809Z`
- effective usage: `9.7924 USD`
- billed: `0.0000 USD`
- charge count: `9135`
- interpretation: no unexpected billed usage spike observed
