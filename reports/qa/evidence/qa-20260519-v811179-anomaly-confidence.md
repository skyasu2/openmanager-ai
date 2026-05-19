# QA Evidence - v8.11.179 Anomaly Confidence

- Date: 2026-05-19 13:09 KST
- Target: Vercel production
- URL: https://openmanager-ai.vercel.app/dashboard/ai-assistant
- Version: 8.11.179
- Commit: 870fb39a02ac21073fdedbd114dbfced6fa8de0c
- GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2535911663
- Vercel deployment: https://openmanager-clytpcga8-skyasus-projects.vercel.app
- Screenshot: `reports/qa/evidence/qa-20260519-v811179-anomaly-confidence.png`

## Checks

1. Production version endpoint returned `8.11.179` with release tag `v8.11.179`.
2. GitLab tag pipeline `2535911663` completed successfully.
3. Playwright MCP opened `/dashboard/ai-assistant` and selected `이상감지/추세`.
4. The anomaly/trend page rendered `cache-redis-dc1-01 - 메모리` with `memory 82% >= 80% · 신호 강도 64%`, confirming confidence is no longer the fixed 90% value.
5. Header `AI` text retained the restored animated gradient CSS: `background-size: 200% 200%`, `animation-name: gradient-diagonal`, `animation-duration: 3s`, transparent text fill.
6. Vercel usage check passed with current billing period effective `$11.4422` and billed `$0.0000`.

## Result

Release-facing targeted QA passed. The previously tracked `anomaly-detection` expert gap for static snapshot confidence is complete in the tested production scope.
