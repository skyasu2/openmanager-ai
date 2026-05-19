# QA-20260519 v8.11.178 AI Gradient Production Evidence

- Target: `https://openmanager-ai.vercel.app`
- Version: `8.11.178`
- Commit: `5801a008e37f60d2159b5bac1399a598614142db`
- GitLab pipeline: `2535756579`
- Verification time: `2026-05-19T02:02:02.767Z`

## Checks

- `/api/version` returned `version=8.11.178`, `releaseTag=v8.11.178`, and the expected commit SHA.
- Two visible `AI` text spans were found on production.
- Both spans used `animationName=gradient-diagonal`, `animationDuration=3s`, and `backgroundSize=200% 200%`.
- Both spans changed computed `background-position` over 650ms:
  - logo `AI`: `45.4547% 50%` -> `94.2925% 50%`
  - hero `AI`: `45.4547% 50%` -> `94.2925% 50%`
- The production `gradient-diagonal` keyframes animate `background-position`, not opacity.
- Dashboard AI assistant button used the shared gradient style in active state:
  - `animationName=gradient-diagonal`
  - `animationDuration=3s`
  - `backgroundSize=200% 200%`
  - `background-position`: `12.0162% 50%` -> `84.711% 50%`

## Local Gates

- Targeted Vitest: passed
- `npm run type-check`: passed
- `npm run lint`: passed
- `npm run test:quick`: passed
- `npm run docs:components:verify`: passed
- `npm run check:usage:vercel`: passed, billed usage remained `$0.0000`
