# TODO - OpenManager AI v5

**Last Updated**: 2026-02-15 KST

## Active Tasks

| Task | Priority | Status |
|------|----------|--------|
| 통합 테스트 확대 | P3 | Done — 63개 신규 테스트 추가 (6개 모듈) |

### Completed (2026-02-15)
- [x] P1: Resume Stream v2 구현 — Upstash resumable, prepareReconnectToStreamRequest, stream-state 완성
- [x] P2: RAG 시스템 개선 — hybrid-text-search, reranker, query-expansion, tavily-hybrid-rag 구현
- [x] P1: OTel 데이터 품질 개선 — network 0-1 ratio 통일, 로그 시간 분산, OOM 시퀀스 수정
- [x] P1: Cloud Run 보안 강화 — timing-safe 비교, SHA-256 해싱, ring buffer, graceful shutdown
- [x] P2: Legacy 데이터 삭제 — `src/data/hourly-data/` + `src/data/otel-processed/` 전체 제거
- [x] P2: Vision Agent fallback 구현 — 빈 응답 방어 + min token guard (256)
- [x] P3: 계획서 정리 — plans/ 51→4개, tasks/ 184→0개, reports 5개 archive 이동
- [x] P3: package.json dangling scripts 수정 (data:sync/otel/all → data:fix/verify)
- [x] P3: feature-cards/tech-stacks 문서 OTel 반영

### Completed (2026-02-10)
- [x] P3: AI SDK `ai@6.0.77 → 6.0.78` 업그레이드 + `@ts-expect-error` 2건 제거
- [x] P3: Dead code 1,465줄 제거 (5 미사용 파일 삭제)
- [x] P2: 대형 파일 리팩토링 완료 (MetricsProvider 682→435, security 596→295, ProcessManager 794→766)
- [x] P2: AsyncLocalStorage 도입 (traceId 자동 전파, 15+ 수동 interpolation 제거)
- [x] P2: `ai-proxy.config.ts` 분할 (634 → 482줄, dead code 100줄 제거)
- [x] P2: `circuit-breaker.ts` 분할 (704 → 394줄, state-store + events 모듈 추출)
- [x] P2: `useHybridAIQuery.ts` 분할 (876 → ~540줄, sub-hooks 추출)
- [x] P2: W3C Trace Context (`traceparent`) end-to-end 전파
- [x] P0: Dev bypass auth 기본값 `true` → `false` (프로덕션 인증 우회 방지)
- [x] P1: Redis 자동 복구 타이머 추가 (60초 후 재연결)
- [x] P1: Cache key 정규화 통일 (`normalizeQueryForCache`)
- [x] P1: Redis KEYS → SCAN 변경 (Upstash O(N) 블로킹 방지)
- [x] P1: `proxyStreamToCloudRun` AbortController 추가 (55초 timeout)
- [x] P0: API 라우트 인증 취약점 해결 (3건)
- [x] P1: Job Queue, Stream timeout, Supervisor validation 버그 수정
- [x] P2: `console.*` → `logger` 마이그레이션 (프로덕션 잔존 0건)
- [x] P3: Retry setTimeout 취소 누락 수정 (메모리 누수 방지)
- [x] P2: `stepCountIs(5)` → 7 상향 (복잡 쿼리 대응)

### Completed (2026-02-08)
- [x] P2: Frontend QA — memo, useShallow, SSE validation
- [x] P3: UI QA — services data, mobile AI button, top5 truncation

### Completed (2026-01-26)
- [x] P1: useButtonType A11y 위반 해결 (142개 → 0개)
- [x] P2: README AI 섹션 업데이트 (AI SDK v6, 5-Agent)
- [x] P3: 레거시 계획서 아카이브 이동 (10개 → archive/)

### 활성 계획서 (Active Plans)

> 5개 완료 계획서 → `archive/` 이동 완료 (2026-02-15)

| 파일 | 상태 | 비고 |
|------|------|------|
| `wbs.md` | 운영 | 전체 진행률 94.2% |

### Completed (2026-01-22)
- [x] 코드 단순화 리팩토링 (YAGNI 원칙 적용)
  - ReactFlowDiagram 모듈 분리 (996줄 → 15개 모듈)
  - AIErrorHandler 제거 (-421줄, 사용처 0곳)
  - ErrorHandlingService 제거 (-2,407줄, 사용처 0곳)
  - **총 ~2,800줄 dead code 제거**

### Completed (2026-01-10 오후)
- [x] 코드 품질 개선 Phase 1-3 완료
  - TODO 주석 정리 (3개 → 0개)
  - SystemChecklist.tsx 분할 (774줄 → 709줄)
  - supervisor/route.ts 분할 (746줄 → 476줄)
- [x] 계획서 검증 및 상태 업데이트
  - AI Engine 구현 100% 완료 확인
  - Langfuse v3.38.6 설치 확인
  - 스트리밍 구현 확인

### Completed (2026-01-10 오전)
- [x] P1: Console → Pino Logger 마이그레이션 (1,561개 → 116개, 92%)
- [x] P2: 대용량 파일 분리 (4개 800줄+ → 0개, 100%)
- [x] P3: any 타입 제거 (17개 → 0개, 100%)

### Completed (2026-01-07)
- [x] Agent SSOT 패턴 리팩토링 (agent-configs.ts 중앙화)
- [x] Langfuse 무료 티어 보호 시스템 구현 (10% 샘플링)
- [x] Cloud Run 무료 티어 최적화 (1 vCPU, 512Mi)
- [x] cloud-run-deploy Skill 추가 (토큰 65% 절감)
- [x] Provider 상태 캐싱 구현 (checkProviderStatus)

### Completed (2026-01-04)
- [x] AI Rate Limit 예측 전환 (Pre-emptive Fallback) 구현
- [x] Provider Quota Tracker 구현 (Vercel + Cloud Run)
- [x] Redis Distributed Circuit Breaker Store 구현
- [x] MCP 서버 전체 동작 검증 (9/9 정상)

### Completed (2025-12-28)
- [x] LangGraph → Vercel AI SDK 마이그레이션 (v5.92.0)
- [x] 멀티-에이전트 오케스트레이션 구현 (`@ai-sdk-tools/agents`)
- [x] AI Engine 아키텍처 문서 최신화

### Documentation Cleanup (2025-12-23)
- [x] 레거시 계획서 아카이브 이동
- [x] docs/development 구조 정리
- [x] 통합 TODO 생성 (`docs/development/ai/TODO.md`)
- [x] 중복 파일 정리

## Domain-Specific TODOs

| Domain | Location | Description |
|--------|----------|-------------|
| **AI Development** | `reports/planning/TODO.md` | Multi-Agent, Prompt Optimization 작업 큐 |
| **Analysis Reports** | `reports/planning/archive/` | 완료/참조용 분석 리포트 보관 |

## Low Priority (Backlog)

| Task | Description | Status |
|------|-------------|--------|
| Semantic Caching | 해시 기반 → 임베딩 기반 유사 쿼리 캐시 매칭 | P3 |
| flushSync 검토 | `useQueryExecution.ts:195` 성능 영향 재평가 | P3 |

## Completed Archive

| Task | Date | Notes |
|------|------|-------|
| **LangGraph → Vercel AI SDK Migration** | **2025-12-28** | v5.92.0 - `@ai-sdk-tools/agents` 기반 멀티-에이전트 |
| AI Testing & Monitoring | 2025-12-23 | Unit/Integration Tests + Cache Monitor |
| AI Architecture Improvements | 2025-12-23 | 4 Tasks (Verifier/Cache/State/Context) |
| GraphRAG 하이브리드 검색 | 2025-12-18 | Vector + Text + Graph |
| Cloud Run 하이브리드 아키텍처 | 2025-12-16 | LangGraph Multi-Agent |
| Vercel LangGraph 제거 | 2025-12-17 | 번들 2MB 감소 |
| 문서 구조 개선 Phase 1-4 | 2025-12-19 | kebab-case 통일 |
| Code Interpreter | 2025-12-18 | Browser-based Python |
| 스크립트 통합 최적화 | 2025-12-14 | 72% 감소 |
| React 19/Next.js 16 업그레이드 | 2025-12-10 | - |

---

_Legacy planning docs archived in: `reports/planning/archive/2025-12/`_
