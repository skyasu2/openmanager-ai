# System Architecture (Current v8)

> Last verified against code: 2026-02-13
> Status: Active Canonical
> Doc type: Explanation

## Overview

OpenManager AI는 다음 2계층으로 동작합니다.

1. Vercel/Next.js App Router (`src/app`)  
2. Cloud Run AI Engine (`cloud-run/ai-engine`)

AI 추론은 Cloud Run에서 수행되고, Next.js는 UI/BFF/프록시 역할을 담당합니다.

## Runtime Stack

- Frontend/BFF: Next.js `16.1.x`, React `19`, TypeScript strict
- AI Engine: Hono + Vercel AI SDK (`cloud-run/ai-engine`)
- Data: Supabase (PostgreSQL + pgvector), Upstash Redis
- State: TanStack Query + Zustand

## High-Level Flow

1. 사용자 질의가 `src/components/ai-*` 또는 AI Sidebar에서 발생
2. Next API Route `src/app/api/ai/supervisor/route.ts`가 요청을 수신
3. BFF가 Cloud Run AI Engine으로 프록시
4. Cloud Run에서 Supervisor/Agent 파이프라인 실행
5. 스트리밍 응답을 BFF를 통해 클라이언트로 전달

## Key Entrypoints

### Frontend and BFF
- `src/app/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/providers/ClientProviders.tsx`
- `src/components/providers/QueryProvider.tsx`
- `src/app/api/ai/supervisor/route.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`

### AI Engine (Cloud Run)
- `cloud-run/ai-engine/src/server.ts`
- `cloud-run/ai-engine/src/routes/supervisor.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/*`

### Data and Rules
- `src/data/hourly-data/*.json`
- `src/data/otel-metrics/hourly/*.json`
- `src/config/rules/system-rules.json`
- `supabase/migrations/*`

## Current API Surface

- Source of truth: `src/app/api/**/route.ts*`
- Current count: 48 routes
- Detailed catalog: [API Endpoints](../../api/endpoints.md)

## Architecture Constraints

- 실제 운영 서버 대신 시뮬레이션/사전 계산 데이터 중심으로 설계
- 무료 티어 운영 비용을 고려한 캐시/프록시/폴백 전략 우선
- Cloud Run 장애 시에도 UI는 degradable 상태를 유지

## Non-Goals

- 이 문서는 과거(v5~v7) 마이그레이션 내역을 다루지 않음
- 히스토리/회고는 `docs/analysis/`, `docs/reviews/`를 참고

## Related

- [AI Engine Architecture](../ai/ai-engine-architecture.md)
- [Hybrid Split](../infrastructure/hybrid-split.md)
- [Folder Structure](../folder-structure.md)
