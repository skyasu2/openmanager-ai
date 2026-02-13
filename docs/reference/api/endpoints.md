# API Endpoints (Code-Synced)

> Last verified against code: 2026-02-13
> Source of truth: `src/app/api/**/route.ts*`
> Doc type: Reference

총 엔드포인트: **48**

## Summary by Group

| Group | Count |
|---|---:|
| ai | 11 |
| alerts | 1 |
| auth | 2 |
| cache | 1 |
| csrf-token | 1 |
| dashboard | 1 |
| database | 1 |
| debug | 3 |
| error-report | 1 |
| health | 1 |
| logs | 1 |
| metrics | 1 |
| monitoring | 1 |
| og | 1 |
| performance | 1 |
| security | 1 |
| sentry-tunnel | 1 |
| servers | 6 |
| servers-unified | 1 |
| simulate | 1 |
| system | 1 |
| test | 3 |
| time | 1 |
| universal-vitals | 1 |
| vercel-usage | 1 |
| version | 2 |
| web-vitals | 1 |

## Endpoint Catalog

### /api/ai

| Endpoint | Methods | Source |
|---|---|---|
| `/api/ai/feedback` | `GET, POST` | `src/app/api/ai/feedback/route.ts` |
| `/api/ai/incident-report` | `GET, POST` | `src/app/api/ai/incident-report/route.ts` |
| `/api/ai/intelligent-monitoring` | `GET, POST` | `src/app/api/ai/intelligent-monitoring/route.ts` |
| `/api/ai/jobs` | `GET, POST` | `src/app/api/ai/jobs/route.ts` |
| `/api/ai/jobs/[id]` | `DELETE, GET` | `src/app/api/ai/jobs/[id]/route.ts` |
| `/api/ai/jobs/[id]/stream` | `GET` | `src/app/api/ai/jobs/[id]/stream/route.ts` |
| `/api/ai/raw-metrics` | `GET` | `src/app/api/ai/raw-metrics/route.ts` |
| `/api/ai/status` | `GET, POST` | `src/app/api/ai/status/route.ts` |
| `/api/ai/supervisor` | `POST` | `src/app/api/ai/supervisor/route.ts` |
| `/api/ai/supervisor/stream/v2` | `GET, POST` | `src/app/api/ai/supervisor/stream/v2/route.ts` |
| `/api/ai/wake-up` | `POST` | `src/app/api/ai/wake-up/route.ts` |

### /api/alerts

| Endpoint | Methods | Source |
|---|---|---|
| `/api/alerts/stream` | `GET` | `src/app/api/alerts/stream/route.ts` |

### /api/auth

| Endpoint | Methods | Source |
|---|---|---|
| `/api/auth/error` | `GET, POST` | `src/app/api/auth/error/route.ts` |
| `/api/auth/revoke-github-token` | `POST` | `src/app/api/auth/revoke-github-token/route.ts` |

### /api/cache

| Endpoint | Methods | Source |
|---|---|---|
| `/api/cache` | `GET, POST` | `src/app/api/cache/route.ts` |

### /api/csrf-token

| Endpoint | Methods | Source |
|---|---|---|
| `/api/csrf-token` | `GET` | `src/app/api/csrf-token/route.ts` |

### /api/dashboard

| Endpoint | Methods | Source |
|---|---|---|
| `/api/dashboard` | `GET, POST` | `src/app/api/dashboard/route.ts` |

### /api/database

| Endpoint | Methods | Source |
|---|---|---|
| `/api/database` | `GET, POST` | `src/app/api/database/route.ts` |

### /api/debug

| Endpoint | Methods | Source |
|---|---|---|
| `/api/debug/auth` | `GET, POST` | `src/app/api/debug/auth/route.ts` |
| `/api/debug/env` | `GET, POST` | `src/app/api/debug/env/route.ts` |
| `/api/debug/sentry-test` | `GET` | `src/app/api/debug/sentry-test/route.ts` |

### /api/error-report

| Endpoint | Methods | Source |
|---|---|---|
| `/api/error-report` | `GET, POST` | `src/app/api/error-report/route.ts` |

### /api/health

| Endpoint | Methods | Source |
|---|---|---|
| `/api/health` | `GET, HEAD` | `src/app/api/health/route.ts` |

### /api/logs

| Endpoint | Methods | Source |
|---|---|---|
| `/api/logs` | `DELETE, GET, POST` | `src/app/api/logs/route.ts` |

### /api/metrics

| Endpoint | Methods | Source |
|---|---|---|
| `/api/metrics` | `POST` | `src/app/api/metrics/route.ts` |

### /api/monitoring

| Endpoint | Methods | Source |
|---|---|---|
| `/api/monitoring/report` | `GET` | `src/app/api/monitoring/report/route.ts` |

### /api/og

| Endpoint | Methods | Source |
|---|---|---|
| `/api/og` | `GET` | `src/app/api/og/route.tsx` |

### /api/performance

| Endpoint | Methods | Source |
|---|---|---|
| `/api/performance/metrics` | `GET, POST` | `src/app/api/performance/metrics/route.ts` |

### /api/security

| Endpoint | Methods | Source |
|---|---|---|
| `/api/security/csp-report` | `GET, OPTIONS, POST` | `src/app/api/security/csp-report/route.ts` |

### /api/sentry-tunnel

| Endpoint | Methods | Source |
|---|---|---|
| `/api/sentry-tunnel` | `OPTIONS, POST` | `src/app/api/sentry-tunnel/route.ts` |

### /api/servers

| Endpoint | Methods | Source |
|---|---|---|
| `/api/servers` | `GET` | `src/app/api/servers/route.ts` |
| `/api/servers/[id]` | `GET` | `src/app/api/servers/[id]/route.ts` |
| `/api/servers/[id]/processes` | `GET` | `src/app/api/servers/[id]/processes/route.ts` |
| `/api/servers/all` | `GET` | `src/app/api/servers/all/route.ts` |
| `/api/servers/next` | `GET, OPTIONS, POST` | `src/app/api/servers/next/route.ts` |
| `/api/servers/realtime` | `GET` | `src/app/api/servers/realtime/route.ts` |

### /api/servers-unified

| Endpoint | Methods | Source |
|---|---|---|
| `/api/servers-unified` | `GET, POST` | `src/app/api/servers-unified/route.ts` |

### /api/simulate

| Endpoint | Methods | Source |
|---|---|---|
| `/api/simulate/data` | `GET` | `src/app/api/simulate/data/route.ts` |

### /api/system

| Endpoint | Methods | Source |
|---|---|---|
| `/api/system` | `GET, POST` | `src/app/api/system/route.ts` |

### /api/test

| Endpoint | Methods | Source |
|---|---|---|
| `/api/test/auth` | `GET, POST` | `src/app/api/test/auth/route.ts` |
| `/api/test/timezone` | `GET` | `src/app/api/test/timezone/route.ts` |
| `/api/test/vercel-test-auth` | `GET, POST` | `src/app/api/test/vercel-test-auth/route.ts` |

### /api/time

| Endpoint | Methods | Source |
|---|---|---|
| `/api/time` | `GET` | `src/app/api/time/route.ts` |

### /api/universal-vitals

| Endpoint | Methods | Source |
|---|---|---|
| `/api/universal-vitals` | `GET, OPTIONS, POST` | `src/app/api/universal-vitals/route.ts` |

### /api/vercel-usage

| Endpoint | Methods | Source |
|---|---|---|
| `/api/vercel-usage` | `GET, POST` | `src/app/api/vercel-usage/route.ts` |

### /api/version

| Endpoint | Methods | Source |
|---|---|---|
| `/api/version` | `GET` | `src/app/api/version/route.ts` |
| `/api/version/status` | `GET` | `src/app/api/version/status/route.ts` |

### /api/web-vitals

| Endpoint | Methods | Source |
|---|---|---|
| `/api/web-vitals` | `GET, OPTIONS, POST` | `src/app/api/web-vitals/route.ts` |

## Notes

- 이 문서는 코드 스캔 결과를 기준으로 유지합니다.
- 라우트 추가/삭제 후 이 문서를 함께 갱신해야 합니다.
- 상세 동작/인증/캐시 정책은 각 라우트 파일 구현을 우선합니다.
