# 의존성 정책

> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-11
> Canonical: docs/reference/architecture/infrastructure/dependency-policy.md
> Tags: dependencies,security,audit,release

OpenManager는 Vercel root app과 Cloud Run AI Engine을 독립 배포하지만, shared contract에 영향을 주는 핵심 dependency는 의도적으로 정렬한다. 목표는 버전 최신화 자체가 아니라 런타임 계약, 보안 대응, free-tier 비용 경계를 안정적으로 유지하는 것이다.

## Version Alignment

| Package group | Policy | Rationale |
|---|---|---|
| `zod` | 같은 major 유지 | schema/type sharing 시 v3/v4 API drift 방지 |
| `pino` | 같은 major 유지 | structured logging 포맷과 transport 동작 일관성 |
| `typescript` | 가능한 exact version 유지 | root/AI Engine 타입 체크 결과 차이 축소 |
| `@ai-sdk/*`, `ai` | root 기준으로 AI Engine 후행 허용 | SDK contract migration을 단계적으로 흡수 |
| React/Next.js | root app only | AI Engine과 분리하되 Vercel build/runtime 안정성 우선 |

Version drift가 생기면 즉시 대규모 업그레이드를 열지 않는다. 영향 범위가 AI stream/tool schema, auth/session, env/deploy boundary, logging/error-reporting에 닿을 때 우선순위를 올리고, 그렇지 않으면 정기 유지보수 사이클에서 처리한다.

## Audit Triage

`npm audit` 결과는 아래 순서로 처리한다.

```text
npm audit finding
  -> same-major fixed release exists?
       yes: update within same major, run targeted checks
       no:
         -> force fix requires downgrade or major break?
              yes: do not apply; record upstream wait memo
              no: evaluate controlled upgrade
  -> vulnerable transitive package is low-value dependency?
       yes: remove dependency or replace with internal focused implementation
       no: pin/override only with explicit compatibility check
```

`npm audit fix --force`는 기본적으로 금지한다. force fix가 major downgrade나 framework line 변경을 제안하면 실제 취약점 해결보다 호환성 리스크가 커질 수 있다.

## Current Audit Exception

2026-05-11 기준 root app의 `next@16.1.6` advisory는 upstream fixed stable release가 아직 없어서 대기 상태로 분류한다.

```text
installed: next@16.1.6
same-major fixed release requested by audit: 16.1.7 or 16.2.3
current action: wait for stable release; do not downgrade to next@15.x
```

이는 backlog나 QA pending 항목이 아니다. 같은-major stable release가 npm에 등록되면 다음 유지보수 사이클에서 처리한다.

```bash
npm install next@latest
npm run type-check
npm run test:quick
npm audit --omit=dev
```

## Verification Matrix

| Change type | Required checks | Optional checks |
|---|---|---|
| root runtime dependency | `npm run type-check`, targeted/import smoke, `git diff --check` | `npm run test:quick` when behavior risk exists |
| AI Engine runtime dependency | `cd cloud-run/ai-engine && npm run type-check`, targeted Vitest | full AI Engine test only for schema/runtime breaks |
| security/audit replacement | targeted regression test, `npm audit --omit=dev` for touched package scope | release-facing QA after deploy if user path changes |
| docs-only policy update | `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` | `npm run docs:links:internal` when links change |

Live LLM, Vercel, Cloud Run, or Supabase tests are not dependency update defaults. Use them only when the changed package affects production routing, deployment, or AI answer behavior.

## Recent Decisions

| Date | Decision | Result |
|---|---|---|
| 2026-05-11 | AI Engine `zod` v3 -> v4 | Completed with schema tests and AI Engine validation |
| 2026-05-11 | AI Engine `pino` v9 -> v10 | Completed with logger targeted tests and type-check |
| 2026-05-11 | Remove `@google-cloud/pino-logging-gcp-config` | Replaced by focused internal structured logging implementation |
| 2026-05-11 | Root React patch update | Completed at `react`/`react-dom` 19.2.6 |
| 2026-05-11 | Next.js audit force downgrade | Rejected; upstream stable patch wait |

## Related Documents

- [Resilience](./resilience.md)
- [Test Strategy](../../../guides/testing/test-strategy.md)
- [AI Standards](../../../guides/ai/ai-standards.md)
