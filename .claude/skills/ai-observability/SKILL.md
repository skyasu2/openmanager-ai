---
name: ai-observability
description: Analyze OpenManager AI assistant routing, provider distribution, latency, failures, fallbacks, and Langfuse traces with npm run langfuse:check. Use when the user asks to inspect AI assistant state, Langfuse traces, routing quality, Analyst or Supervisor latency, provider behavior, or whether AI QA needs browser verification.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# AI Observability

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Langfuse REST evidence로 AI 어시스턴트 내부 라우팅, provider, latency, failure, fallback 상태를 먼저 확인합니다.

## Workflow

1. 범위를 정합니다.
- AI routing, agent selection, provider distribution, latency, failure, fallback 질문이면 이 스킬을 먼저 사용합니다.
- UI 동작, 스크린샷, 콘솔 에러, release-facing QA 기록이 필요하면 확인 후 `qa-ops`로 넘깁니다.
- 기본 local smoke gate에는 live Langfuse 호출을 넣지 않습니다.

1. 최소 쿼리를 실행합니다.
- 최근 baseline: `npm run langfuse:check -- --limit 50`
- Supervisor/Analyst 중심: `npm run langfuse:check -- --limit 100 --q supervisor`
- 구조화 비교: `npm run langfuse:check -- --limit 100 --json`
- 이름 필터: `npm run langfuse:check -- --q <term>`
- sandbox DNS/network 제한이면 같은 명령만 승인된 외부 접근으로 재실행합니다. `.env.local` secret 값은 출력하지 않습니다.

1. 결과를 읽습니다.
- Provider mix: deterministic, Mistral, Groq, Z.AI 등 live provider 분포
- Latency: avg/P95, 특히 Supervisor, Analyst, fallback path
- Fail/fallback: failed traces, retry, `usedFallback` signal
- Routing: RCA, "왜", anomaly, Advisor, Analyst, Reporter, Metrics Query prompt의 `finalAgent`/metadata
- Recency: trace가 없으면 제품 실패로 단정하기 전에 최근 AI traffic 부재 또는 observability gap으로 분류합니다.

1. 다음 액션을 고릅니다.
- `healthy`: UI proof가 필요하지 않으면 Playwright QA 생략
- `routing-gap`: `state-triage` 후 routing/contract test 수정
- `latency-gap`: before/after trace baseline 수집 후 code/cache/prompt path 우선
- `provider-gap`: provider metadata/quota/fallback 확인
- `ui-proof-needed`: `qa-ops`로 Playwright/Vercel QA
- `qa-record-needed`: `qa-ops`로 release-facing evidence 기록

## Output Format

```text
AI Observability
- scope: routing | latency | provider | fallback | trace-health
- sample: <limit/filter/date range>
- provider mix: <summary>
- latency: avg <n>s / p95 <n>s
- failures: <count and pattern>
- routing: <pass|warn|fail with reason>
- next step: <single best action>
```

## References

- `scripts/qa/langfuse-check.js`
- `docs/guides/observability.md`
- `docs/reference/architecture/ai/ai-engine-evaluation.md`
