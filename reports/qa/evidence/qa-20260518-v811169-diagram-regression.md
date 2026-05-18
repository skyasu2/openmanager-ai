# v8.11.169 Diagram Regression Closure

Target: https://openmanager-ai.vercel.app
Version: 8.11.169
GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2532228902
Checked at: 2026-05-18T09:31:08+09:00

## Production Playwright MCP Check

- `/api/version`: `8.11.169`
- Landing footer version: `v8.11.169`
- AI Assistant modal:
  - Opened feature card `AI 어시스턴트`
  - Toggled `아키텍처 보기`
  - Static diagram rendered with `8` layers, `21` nodes, `27` connections
  - Verified visible/accessibility text includes `Supervisor Router`, `Fact Layer`, `Knowledge Lite`, `UIMessageStream`, `Resumable v2`, `Artifact Replay`, `텍스트 Providers`, `라우팅`
- Cloud Platform modal:
  - Opened feature card `클라우드 플랫폼 활용`
  - Toggled `아키텍처 보기`
  - Static diagram rendered with `4` layers, `11` nodes, `13` connections
  - Verified visible/accessibility text includes `Cloud Run Engine`, `GitLab`, `validate · semver tag deploy`, `Upstash Redis`

## Code Review Notes

- `StaticArchitectureDiagram` now uses visual-width truncation instead of raw character count, so CJK labels reserve more space before ellipsis.
- Node width buckets were increased in the static diagram layout. The larger canvas is acceptable because the component already owns horizontal overflow scrolling.
- AI Assistant duplicate dashed provider-gate arrows were removed in data, reducing connection count from `29` to `27` and making the routing layer less cluttered.
- Residual long sublabels may still ellipsize inside compact nodes by design; the primary node labels and modal summary counts are no longer clipped in the checked production paths.

## Validation

- Targeted static diagram unit test: passed
- `npm run test:quick`: passed
- `npm run type-check`: passed
- `npm run lint`: passed
- `npm run docs:components:verify`: passed
- `git diff --check`: passed
- Vercel usage: effective `10.7667 USD`, billed `0.0000 USD`
