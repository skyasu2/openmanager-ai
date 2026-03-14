---
name: state-triage
description: Analyze current OpenManager QA, runtime, deployment, and AI-path state; identify the primary symptom, root cause, free-tier fit, and next action.
version: v1.0.0
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
- `sed -n '1,220p' docs/guides/ai/ai-standards.md`
- `sed -n '1,220p' reports/qa/production-qa-2026-02-25.md`
- `sed -n '1,220p' reports/qa/QA_STATUS.md`
- `cat reports/qa/qa-tracker.json`
- 필요 시 최신 run JSON 1~3개 확인

2. 실패 유형 분류.
- `availability`: health fail, 5xx, auth break, env drift
- `logic-or-quality`: network `200`인데 UI/응답 품질이 잘못됨
- `data-or-ssot`: dashboard와 AI가 다른 사실을 말함
- `latency-or-cold-start`: 첫 호출 지연, retry 후 회복
- `observability-gap`: 기능은 되지만 자동화 관측이 약함

3. 최소 코드 경로로 축소.
- UI만 깨졌으면 컴포넌트/훅
- `/api/*` mismatch면 Next.js route/proxy
- AI 응답/라우팅/fallback이면 `cloud-run/ai-engine`
- preview/production 차이면 env/deploy script

4. infra vs code 판정.
- `HTTP 200`인데 내용만 잘못되면 infra sizing이 아니라 코드/프롬프트 문제로 본다
- Reporter/Analyst는 정상이고 Chat만 실패하면 route/agent별 로직으로 본다

5. free-tier 적합성 확인.
- `docs/guides/ai/ai-standards.md`
- `cloud-run/ai-engine/deploy.sh`
- `cloud-run/ai-engine/cloudbuild.yaml`
- 기본 해법은 routing/fallback/cache/test/env sync여야 한다

6. 다음 액션 선택.
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
- scope: frontend | next-api | cloud-run | env/deploy | data-ssot
- root cause: <most likely cause>
- free-tier fit: yes | no | conditional
- next step: <single best action>
```

## Changelog

- 2026-03-14: v1.0.0 - QA 이후 원인 분류/다음 액션 결정용 스킬 추가
