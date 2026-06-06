---
name: state-triage
description: Analyze current OpenManager QA, runtime, deployment, and AI-path state; identify the primary symptom, root cause, free-tier fit, and next action.
version: v2.2.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# State Triage

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

최근 QA/런타임/배포 증거를 바탕으로 다음 액션을 좁힙니다.

## Trigger Keywords

- "/state-triage"
- "현재 뭐가 문제야", "왜 실패했어", "근본 원인", "다음 단계 뭐야"
- "무료 티어 안에서 해결 가능해?"

## Cloud Run Endpoint Resolution

Cloud Run URL은 하드코딩하지 않습니다. `.env.local`의 `CLOUD_RUN_AI_URL`을 우선 사용하고, 없으면 `gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)'`로 조회합니다.

## Workflow

1. 증거 우선 로드.
- `npm run qa:status` — 누적 QA 요약 (가장 빠른 현황)
- QA_STATUS.md 및 qa-tracker.json 확인:
  - `cat reports/qa/QA_STATUS.md`
  - `cat reports/qa/qa-tracker.json | python3 -m json.tool | head -60`
- 최신 run JSON 확인 필요 시: `ls reports/qa/runs/$(date +%Y)/ | tail -5`

1. AI provider 상태 확인 (AI 관련 장애 시 필수).

```bash
CLOUD_RUN_AI_URL="$(grep -E '^CLOUD_RUN_AI_URL=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$CLOUD_RUN_AI_URL" ]; then
  CLOUD_RUN_AI_URL="$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')"
fi
CLOUD_RUN_API_SECRET="$(grep -E '^CLOUD_RUN_API_SECRET=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
curl -s "$CLOUD_RUN_AI_URL/health"
curl -s "$CLOUD_RUN_AI_URL/api/ai/providers" -H "X-API-Key: $CLOUD_RUN_API_SECRET"
```

- provider/model availability는 계정·날짜에 따라 변할 수 있으므로 `/api/ai/providers`의 `modelMetadata`/`modelDrift`와 `cloud-run/ai-engine` 설정을 근거로 판단한다.
- 하드코딩된 모델 무료 여부를 사실처럼 단정하지 않는다.
- Z.AI(GLM Flash)는 v8.11.156부터 Reporter primary provider임. `zai: true` 부재 시 Reporter 에이전트가 Mistral fallback으로 전환됨.

1. 실패 유형 분류.
- `availability`: health fail, 5xx, auth break, env drift
- `logic-or-quality`: network `200`인데 UI/응답 품질이 잘못됨
- `data-or-ssot`: dashboard와 AI가 다른 사실을 말함
- `latency-or-cold-start`: 첫 호출 지연, retry 후 회복
- `ai-provider-quota`: AI 응답 없음/빈 응답 → rate limit 또는 model 접근 불가 (Groq RPD 1,000/일, Z.AI 장애 시 Reporter fallback 경로 확인)
- `observability-gap`: 기능은 되지만 자동화 관측이 약함
- `observability-monitoring`: timing header, trace, Langfuse, sampled traceId visibility 문제
- `observability-monitoring`, `latency-or-cold-start`, `ai-provider-quota`, AI routing 증상은 browser-heavy QA 전에 `ai-observability`와 `npm run langfuse:check`로 trace evidence를 확인합니다.

1. 최소 코드 경로로 축소.
- UI만 깨졌으면 컴포넌트/훅
- `/api/*` mismatch면 Next.js route/proxy
- AI 응답/라우팅/fallback이면 `cloud-run/ai-engine`
- preview/production 차이면 env/deploy script

1. infra vs code 판정.
- `HTTP 200`인데 내용만 잘못되면 infra sizing이 아니라 코드/프롬프트 문제로 본다
- Reporter/Analyst는 정상이고 Chat만 실패하면 route/agent별 로직으로 본다
- AI 응답이 빈 경우 provider fallback 로그 확인: Cloud Run logs에서 `[NLQ]`, `[Analyst]` 등 검색

1. free-tier 적합성 확인.
- Cloud Run: 1 vCPU, 512Mi, e2-medium 한도 내
- Provider/model 한도와 접근 가능 여부는 `/api/ai/providers` 응답, `cloud-run/ai-engine/src/services/ai-sdk/provider-model-metadata.ts`, 공식 문서 기준으로 재확인
- 기본 해법은 routing/fallback/cache/test/env sync여야 한다

1. 다음 액션 선택.
- `code-fix`
- `config-fix`
- `deploy-and-qa`
- `wont-fix`
- `broader-qa`

## Related Skills

- `qa-ops` - 최종 QA/기록
- `ai-observability` - Langfuse trace, provider distribution, routing, latency, failure/fallback 확인
- `cloud-run` - Cloud Run deploy/cost
- `env-sync` - preview/production env drift 정리

## Output Format

```text
State Triage
- symptom: <what failed>
- scope: frontend | next-api | cloud-run | env/deploy | data-ssot | ai-provider
- root cause: <most likely cause>
- free-tier fit: yes | no | conditional
- next step: <single best action>
```

## Changelog

- 2026-06-06: v2.3.0 - AI observability symptoms에 Langfuse precheck skill 연결
- 2026-05-21: v2.2.0 - Z.AI Reporter primary 맥락 추가, Groq RPD 병목 ai-provider-quota 분류에 명시
- 2026-04-25: v2.1.0 - Cloud Run URL 하드코딩 제거, provider/model 무료 여부 단정 제거
- 2026-03-14: v1.0.0 - QA 이후 원인 분류/다음 액션 결정용 스킬 추가
- 2026-04-03: v2.0.0 - 하드코딩 날짜 파일 경로 제거, AI provider 상태 체크 추가, Cerebras 제약 명시, sed 패턴 → npm run qa:status 전환
