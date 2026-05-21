# QA Evidence - v8.11.195 UI Release Smoke

Target: Vercel production + GitLab release pipeline
Version: v8.11.195
Commit: `c989e47df4c8c577022ab73b5069e63705b0d9b1`
Deployment: `dpl_8ciG6QnRbVu5zh95pJWwF16vibKG`
Production URL: https://openmanager-ai.vercel.app

## Result

Release smoke passed.

- Code review: no blocking findings after fixing the system-boot shared visual surface class and CSS selector comment.
- Local targeted DOM tests: `MouseSpotlight.test.tsx` and `FeatureCardModal.test.tsx`, 10 tests passed.
- Local targeted node tests: `feature-cards.data.test.ts` and `landing-cursor-guard.test.ts`, 5 tests passed.
- Local smoke gates: `test:quick`, `type-check`, `lint`, `test:contract`, `storybook:smoke`, and `build:ci` passed.
- Component dependency map was regenerated and verified.
- Main GitLab pipeline `2542527886` passed for `627851e54`.
- Release tag pipeline `2542542939` passed for `v8.11.195`.
- Post-deploy smoke passed for `/`, `/login`, and `/api/version`.
- `/api/version` returned version `8.11.195` and commit `c989e47df4c8c577022ab73b5069e63705b0d9b1`.

## Decision

Release decision: go.

This run covers the changed UI surfaces and deployment/version propagation. AI conversational behavior was not changed in this release, so live AI QA was not rerun.
