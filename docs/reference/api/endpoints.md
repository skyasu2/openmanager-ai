# API Endpoints (Code-Synced)

> 코드 기준 API 엔드포인트 동기화 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-17
> Canonical: docs/reference/api/endpoints.md
> Tags: api,endpoints,reference
>
> Last verified against code: 2026-02-17
> Source of truth: `src/app/api/**/route.ts*`

총 엔드포인트: **34**

## Summary by Group

| Group | Count |
|---|---:|
| ai | 10 |
| alerts | 1 |
| auth | 2 |
| csrf-token | 1 |
| database | 1 |
| health | 1 |
| metrics | 1 |
| monitoring | 1 |
| og | 1 |
| performance | 1 |
| security | 1 |
| sentry-tunnel | 1 |
| servers | 4 |
| servers-unified | 1 |
| system | 1 |
| test | 2 |
| time | 1 |
| vercel-usage | 1 |
| version | 2 |

## Endpoint Catalog

### /api/ai

| Endpoint | Methods | Source |
|---|---|---|
| `/api/ai/feedback` | `GET, POST` | `src/app/api/ai/feedback/route.ts` |
| `/api/ai/incident-report` | `GET, POST` | `src/app/api/ai/incident-report/route.ts` |
| `/api/ai/intelligent-monitoring` | `GET, POST` | `src/app/api/ai/intelligent-monitoring/route.ts` |
| `/api/ai/jobs` | `GET, POST` | `src/app/api/ai/jobs/route.ts` |
| `/api/ai/jobs/[id]` | `GET, DELETE` | `src/app/api/ai/jobs/[id]/route.ts` |
| `/api/ai/jobs/[id]/stream` | `GET` | `src/app/api/ai/jobs/[id]/stream/route.ts` |
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

### /api/csrf-token

| Endpoint | Methods | Source |
|---|---|---|
| `/api/csrf-token` | `GET` | `src/app/api/csrf-token/route.ts` |

### /api/database

| Endpoint | Methods | Source |
|---|---|---|
| `/api/database` | `GET, POST` | `src/app/api/database/route.ts` |

### /api/health

| Endpoint | Methods | Source |
|---|---|---|
| `/api/health` | `GET, HEAD` | `src/app/api/health/route.ts` |

### /api/metrics

| Endpoint | Methods | Source |
|---|---|---|
| `/api/metrics` | `GET, POST` | `src/app/api/metrics/route.ts` |

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
| `/api/security/csp-report` | `GET, POST, OPTIONS` | `src/app/api/security/csp-report/route.ts` |

### /api/sentry-tunnel

| Endpoint | Methods | Source |
|---|---|---|
| `/api/sentry-tunnel` | `GET, POST` | `src/app/api/sentry-tunnel/route.ts` |

### /api/servers

| Endpoint | Methods | Source |
|---|---|---|
| `/api/servers` | `GET` | `src/app/api/servers/route.ts` |
| `/api/servers/[id]` | `GET` | `src/app/api/servers/[id]/route.ts` |
| `/api/servers/[id]/processes` | `GET` | `src/app/api/servers/[id]/processes/route.ts` |
| `/api/servers/next` | `GET, POST, OPTIONS` | `src/app/api/servers/next/route.ts` |

### /api/servers-unified

| Endpoint | Methods | Source |
|---|---|---|
| `/api/servers-unified` | `GET, POST` | `src/app/api/servers-unified/route.ts` |

### /api/system

| Endpoint | Methods | Source |
|---|---|---|
| `/api/system` | `GET, POST` | `src/app/api/system/route.ts` |

### /api/test

| Endpoint | Methods | Source |
|---|---|---|
| `/api/test/auth` | `GET, POST` | `src/app/api/test/auth/route.ts` |
| `/api/test/vercel-test-auth` | `GET, POST` | `src/app/api/test/vercel-test-auth/route.ts` |

### /api/time

| Endpoint | Methods | Source |
|---|---|---|
| `/api/time` | `GET` | `src/app/api/time/route.ts` |

### /api/vercel-usage

| Endpoint | Methods | Source |
|---|---|---|
| `/api/vercel-usage` | `GET, POST` | `src/app/api/vercel-usage/route.ts` |

### /api/version

| Endpoint | Methods | Source |
|---|---|---|
| `/api/version` | `GET` | `src/app/api/version/route.ts` |
| `/api/version/status` | `GET` | `src/app/api/version/status/route.ts` |
