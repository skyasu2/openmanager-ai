---
name: env-sync
description: Diagnose and fix OpenManager environment drift across .env.local, Vercel preview/production, and server-side fallbacks.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# Env Sync

runtime env drift를 먼저 해결하고 그 다음에 제품 코드 변경 여부를 판단합니다.

## Trigger Keywords

- "/env-sync"
- "env 동기화", "preview만 깨져", "production만 깨져"
- "SESSION_SECRET 없어", "supabase env 문제"

## Workflow

1. 현재 sync 경로 확인.
- `sed -n '1,220p' docs/guides/ai/ai-standards.md`
- `sed -n '1,240p' scripts/env/sync-vercel.sh`
- `sed -n '1,220p' src/lib/supabase/env.ts`

2. env drift 신호 판정.
- preview fails while production passes
- `/api/health` or login flow returns `500` after deploy
- missing `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`
- local works but Vercel runtime does not

3. 로컬 source-of-truth 확인.
- `.env.local`에서 필요한 변수 존재 여부 확인
- 수동 파싱 시 양끝 따옴표 제거

4. 대상 환경 확인.
- `vercel env ls preview`
- `vercel env ls production`

5. 안전한 동기화 수행.
- 기본: `bash scripts/env/sync-vercel.sh`
- 필요한 경우에만 특정 변수 `vercel env add ... --force`
- required var 누락은 blocker로 처리

6. 동기화 후 검증.
- `curl -s https://openmanager-ai.vercel.app/api/health`
- 필요 시 `curl -s https://openmanager-ai.vercel.app/api/health?service=ai`

## Related Skills

- `state-triage` - 원인 판별
- `qa-ops` - env 수정 후 Vercel QA/기록

## Output Format

```text
Env Sync Summary
- target: preview | production | both
- issue: <missing var | stale var | drift | not-env>
- synced: <vars or count>
- verification: pass | fail | blocked
- next step: <single best action>
```

## Changelog

- 2026-03-14: v1.0.0 - preview/production env drift 대응 스킬 추가
