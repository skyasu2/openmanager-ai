---
name: env-sync
description: Diagnose and fix OpenManager environment drift across .env.local, Vercel preview/production, and Cloud Run secrets.
version: v2.1.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# Env Sync

> Common baseline: before editing this skill, review `docs/guides/ai/skill-standards.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

runtime env drift를 먼저 해결하고 그 다음에 제품 코드 변경 여부를 판단합니다.

## Trigger Keywords

- "/env-sync"
- "env 동기화", "preview만 깨져", "production만 깨져"
- "supabase env 문제", "AI 안 됨", "api key 없어"

## Env 계층 구조

| 계층 | 파일/경로 | 관리 주체 |
|------|----------|----------|
| 로컬 개발 | `.env.local` | 수동 유지 |
| Vercel Preview | Vercel Dashboard / CLI | `vercel env ls preview` |
| Vercel Production | Vercel Dashboard / CLI | `vercel env ls production` |
| Cloud Run | GCP Secret Manager | `gcloud secrets list` |

## 핵심 환경변수 체크리스트

**Vercel (Frontend)**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `CLOUD_RUN_AI_URL`, `CLOUD_RUN_API_SECRET`
- `GOOGLE_AI_API_KEY`, `GOOGLE_AI_ENABLED`

**Cloud Run (AI Engine)**
- `CEREBRAS_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`
- `GOOGLE_AI_API_KEY` (Gemini Vision)
- `OPENROUTER_API_KEY`, `TAVILY_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUD_RUN_API_SECRET`

## Workflow

1. drift 신호 판정.
- preview fails while production passes
- `/api/health` 또는 login flow `500` 반환 (deploy 후)
- AI 기능만 실패 → Cloud Run AI provider 키 확인
- 로컬은 되는데 Vercel에서만 실패

1. 로컬 source-of-truth 확인.
- `.env.local` 존재 여부 및 필수 변수 확인
- `grep -E "^(GROQ|CEREBRAS|MISTRAL|GOOGLE_AI|OPENROUTER|TAVILY)_API_KEY" .env.local | sed 's/=.*/=***/'`
- 키 값에 따옴표 포함 여부 주의 (`tr -d '"'` 후 사용)

1. Vercel 환경 확인.
- `vercel env ls preview`
- `vercel env ls production`
- 누락 변수 확인

1. 안전한 동기화 수행.
- 기본: `bash scripts/env/sync-vercel.sh`
- 특정 변수만: `echo "VALUE" | vercel env add VAR_NAME production --force`
- required var 누락은 blocker로 처리, 선작업 후 진행

1. Cloud Run env 확인 (AI 장애 시).
- Cloud Run URL은 `.env.local`의 `CLOUD_RUN_AI_URL`을 우선 사용하고 없으면 `gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)'`로 조회
- AI provider 상태:

```bash
CLOUD_RUN_AI_URL="$(grep -E '^CLOUD_RUN_AI_URL=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$CLOUD_RUN_AI_URL" ]; then
  CLOUD_RUN_AI_URL="$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')"
fi
curl -s "$CLOUD_RUN_AI_URL/health"
```

- 응답에서 `groq/cerebras/mistral/gemini/openrouter` 모두 `true`인지 확인
- Cloud Run 시크릿 반영 배포는 `cloud-run` 스킬 기준을 따른다. 기본은 GitLab CI `deploy_ai_engine`, 직접 `deploy.sh`는 명시 요청/runner 장애/긴급 복구 fallback만 허용한다.

1. 동기화 후 검증.
- `curl -s https://openmanager-ai.vercel.app/api/health | python3 -m json.tool`
- AI 검증: `curl -s https://openmanager-ai.vercel.app/api/health?service=ai`

## Related Skills

- `state-triage` - 원인 판별 (AI provider 상태 포함)
- `qa-ops` - env 수정 후 Vercel QA/기록
- `cloud-run` - Cloud Run 재배포

## Output Format

```text
Env Sync Summary
- target: preview | production | cloud-run | all
- issue: <missing var | stale var | drift | ai-key-missing>
- synced: <vars or count>
- verification: pass | fail | blocked
- next step: <single best action>
```

## Changelog

- 2026-04-25: v2.1.0 - Cloud Run URL 하드코딩 제거, CLOUD_RUN_AI_URL/gcloud 조회 기준 반영
- 2026-03-14: v1.0.0 - preview/production env drift 대응 스킬 추가
- 2026-04-03: v2.0.0 - sed 패턴 제거, AI provider 환경변수 체크리스트 추가, Cloud Run 계층 추가
