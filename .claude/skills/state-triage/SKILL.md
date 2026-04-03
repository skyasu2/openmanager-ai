---
name: state-triage
description: Analyze current OpenManager QA, runtime, deployment, and AI-path state; identify the primary symptom, root cause, free-tier fit, and next action.
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# State Triage

최근 QA/런타임/배포 증거를 바탕으로 다음 액션을 좁힙니다.

## Trigger Keywords

- "/state-triage"
- "현재 뭐가 문제야", "왜 실패했어", "근본 원인", "다음 단계 뭐야"
- "무료 티어 안에서 해결 가능해?"

## Workflow

1. 증거 우선 로드.
- `npm run qa:status` — 누적 QA 요약 (가장 빠른 현황)
- QA_STATUS.md 및 qa-tracker.json 확인:
  - `cat reports/qa/QA_STATUS.md`
  - `cat reports/qa/qa-tracker.json | python3 -m json.tool | head -60`
- 최신 run JSON 확인 필요 시: `ls reports/qa/runs/$(date +%Y)/ | tail -5`

2. AI provider 상태 확인 (AI 관련 장애 시 필수).
- Cloud Run health: `curl -s https://ai-engine-490817238363.asia-northeast1.run.app/health`
- provider 상태: `curl -s https://ai-engine-490817238363.asia-northeast1.run.app/api/ai/providers -H "X-API-Key: $(grep CLOUD_RUN_API_SECRET .env.local | cut -d= -f2- | tr -d '"')"`
- **알려진 제약**: Cerebras `gpt-oss-120b`는 무료 계정에서 접근 불가 (404) → Groq가 자동 fallback
- Fallback chain: Cerebras → Groq → Mistral (텍스트), Gemini → OpenRouter (Vision)

3. 실패 유형 분류.
- `availability`: health fail, 5xx, auth break, env drift
- `logic-or-quality`: network `200`인데 UI/응답 품질이 잘못됨
- `data-or-ssot`: dashboard와 AI가 다른 사실을 말함
- `latency-or-cold-start`: 첫 호출 지연, retry 후 회복
- `ai-provider-quota`: AI 응답 없음/빈 응답 → rate limit 또는 model 접근 불가
- `observability-gap`: 기능은 되지만 자동화 관측이 약함

4. 최소 코드 경로로 축소.
- UI만 깨졌으면 컴포넌트/훅
- `/api/*` mismatch면 Next.js route/proxy
- AI 응답/라우팅/fallback이면 `cloud-run/ai-engine`
- preview/production 차이면 env/deploy script

5. infra vs code 판정.
- `HTTP 200`인데 내용만 잘못되면 infra sizing이 아니라 코드/프롬프트 문제로 본다
- Reporter/Analyst는 정상이고 Chat만 실패하면 route/agent별 로직으로 본다
- AI 응답이 빈 경우 provider fallback 로그 확인: Cloud Run logs에서 `[NLQ]`, `[Analyst]` 등 검색

6. free-tier 적합성 확인.
- Cloud Run: 1 vCPU, 512Mi, e2-medium 한도 내
- Cerebras 무료: `llama3.1-8b`, `qwen-3-235b-a22b-instruct-2507` 사용 가능 (`gpt-oss-120b` 접근 불가)
- Groq 무료: `llama-3.3-70b-versatile` 정상
- Gemini 무료: `gemini-2.5-flash` — RPD 250/일, 10 RPM (2025-12 이후 감소)
- Tavily 무료: 월 1,000 크레딧
- 기본 해법은 routing/fallback/cache/test/env sync여야 한다

7. 다음 액션 선택.
- `code-fix`
- `config-fix`
- `deploy-and-qa`
- `wont-fix`
- `broader-qa`

## Related Skills

- `qa-ops` - 최종 QA/기록
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

- 2026-03-14: v1.0.0 - QA 이후 원인 분류/다음 액션 결정용 스킬 추가
- 2026-04-03: v2.0.0 - 하드코딩 날짜 파일 경로 제거, AI provider 상태 체크 추가, Cerebras 제약 명시, sed 패턴 → npm run qa:status 전환
