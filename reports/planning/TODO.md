# TODO - OpenManager AI v8

**Last Updated**: 2026-03-16 KST

## Active Tasks

| Task | Priority | Status |
|------|----------|--------|
| 진행 중 항목 없음 | - | - |

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| 진행 중 보류 항목 없음 | - | - | - |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Next.js dev/Turbopack 중첩 App Router 404 재현 조사 | P3 | probe 기준 최신 상태: `npm run dev:readiness`(Turbopack)는 `/api/version` 준비까지 약 `96s`, 준비 후 `/api/ai/*` nested route는 `non-404` 확인. 반면 `npm run dev:readiness:webpack`은 `Ready in 70.7s` 로그 후에도 `/api/version` compile이 길어 `120s` timeout. 다음 단계는 route 404 재현보다 **webpack readiness 지연 최소 재현**과 `proxy`/`/api/version` compile 경로 분리 |

### Completed (2026-03-15)
- [x] P3: Cloud Run 대형 파일 리팩토링 Phase 3 완료 — `incident-report` route + `ai-proxy.config.ts` 책임 분리 마감
- [x] P3: `ai-proxy.config.ts` 분리 — env 파싱/Zod 검증을 `config-loader.ts`로 이동, 퍼사드는 캐시 singleton + accessor만 유지(325→146)
- [x] P3: `incident-report` route 분리 시작 — `route.ts`를 thin handler로 축소(349→48), Cloud Run proxy/cache/retry/response 조합은 `post-handler.ts`로 분리
- [x] P2: Cloud Run 실배포 검증 — `bash deploy.sh` 기본 경로 성공, Cloud Build `9cdc5c74-97ae-4752-b532-365f8c69fd7f`, revision `ai-engine-00249-tg7`, `/health` 200, `/monitoring` 403
- [x] P2: Cloud Run 배포 기본값 복원 — `deploy.sh`가 build-only Docker preflight를 기본 수행하도록 복원, full local `/health` 검사는 opt-in으로 유지
- [x] P2: Cloud Run `docker:preflight` 복구 — `npm prune --production` 정체 제거, `prod-deps` stage 도입, local build-only/full preflight + `/health` 확인
- [x] P3: Semantic Caching — exact miss 시 token-hash embedding 기반 유사 쿼리 캐시 fallback 추가, 저장 메타데이터/유사도 계산/단위 테스트 반영

### Test Coverage Gap (Closed)

2026-03-05 코드리뷰에서 식별된 우선 테스트 대상 5건은 모두 완료되어 `Completed (2026-03-07)`에 이관됨.

우선 테스트 대상:
1. `/api/health/route.ts` — 프로덕션 모니터링 핵심
2. `/api/servers-unified/route.ts` — 메인 데이터 엔드포인트 (494줄)
3. `/api/servers/[id]/route.ts` — 서버 상세 (397줄)
4. `src/services/code-interpreter/pyodide-service.ts` — 미테스트
5. `src/services/notifications/BrowserNotificationService.ts` — 미테스트

### Completed (2026-03-07)
- [x] P0: v8.8.0 릴리스 (29커밋) — Reporter 품질 개선, CSRF 보안, 테스트 93개 추가
- [x] P2: Cloud Run 배포 — v8.8.0 (faad6169f), 빌드 7분 13초, health check HTTP 200 통과
- [x] P1: Reporter 파이프라인 품질 개선 — 임계값 SSOT 버그 수정(memory 85→80, disk 90→80), 근접 경고, 트렌드 예측, 서버 타입별 CLI 명령어
- [x] P2: `/api/servers/[id]` 테스트 추가 (31 tests) — enhanced/legacy 포맷, history, 서버 검색, 404, 환경 매핑, 에러 핸들링
- [x] P2: Services 테스트 추가 — BrowserNotificationService (13), PyodideService (7), SystemInactivityService (12)
- [x] P2: Hooks 테스트 추가 — useDashboardStats (12), useServerDataCache (7), useResizable (11)

### Completed (2026-03-06)
- [x] P0: Provider quota-tracker 수치 교정 — Cerebras 24M→1M TPD, Groq 100K→500K TPD, Groq TPM 12K→6K, Gemini RPM 15→10
- [x] P0: Cerebras 8K context 방어 — 세션 히스토리 4메시지 제한 (buildContext)
- [x] P1: Reranker Groq 전환 — Cerebras 1M TPD 보존을 위해 reranker를 Groq으로 분리
- [x] P0: v8.7.9 릴리스 (43커밋)
- [x] P1: 보안 수정 — API key timing attack 방어 (length leak 제거), error message 내부 정보 노출 차단
- [x] P2: SSE 스트림 에러 핸들링 — 연결 끊김 시 unhandled rejection 방지
- [x] P2: Redis CB 초기화 race condition 수정 — promise 캐싱으로 중복 초기화 방지
- [x] P2: 코드리뷰 4라운드 (AI Engine resilience, Vercel frontend AI, Data SSOT, Cloud Run pipeline) — 44건 발견, 7건 수정
- [x] P2: Production QA 7/7 통과 (Playwright MCP, v8.7.8 → v8.7.9)

### Completed (2026-03-05)
- [x] P1: CI/CD 파이프라인 분석 및 개선
  - CodeQL SAST 워크플로우 추가 (`codeql-analysis.yml`, v4)
  - Hardcoded secrets 검사 hard-fail 전환 (`exit 1`)
  - `npm audit --audit-level=high` CI code-quality job에 추가
  - E2E 타임아웃 15분→20분 (Cloud Run cold start 대응)
  - keep-alive 환경변수 `NEXT_PUBLIC_SUPABASE_URL`로 통일
- [x] P1: `/api/version` 라우트 복원 — 삭제되어 E2E 연속 실패 원인이었음
- [x] P1: CodeQL 설정 수정 — 존재하지 않는 `Security.ql` pack 참조 제거
- [x] P3: GitLab 이전 가능성 분석 문서 작성 (`docs/reference/architecture/infrastructure/gitlab-migration-feasibility.md`)

### Completed (2026-02-22)
- [x] P1: 이메일 Magic Link 로그인 추가 — Supabase OTP 기반, 소셜 로그인과 병행
- [x] P1: 런타임 로그 레벨 API + AIDebugPanel UI 토글 — TTL 자동 리셋, Vercel + Cloud Run 양쪽
- [x] P1: GPL v3 라이선스 적용 — LICENSE 파일 + README 배지
- [x] P1: 게스트 PIN 브루트포스 방어 — 5회 실패 → 1분 잠금 (Redis + 메모리 폴백)
- [x] P2: Dead code 20+ 파일 삭제 — 미사용 스토어, 서비스, 테스트, 유틸리티 정리
- [x] P2: 게스트 정책 단순화 — CIDR IP 범위 차단 제거, 국가코드 기반으로 통일
- [x] P2: 로그인 버튼 순서 변경 — 소셜 → 이메일 → 게스트
- [x] P2: Storybook 스토리 추가 — 이메일 로그인, AIDebugPanel, stale mock 수정
- [x] P2: 랜딩 히어로 텍스트 및 Feature Card 메시징 개선
- [x] P3: Playwright 스크린샷 정리 — 778개/356MB → 6개/1.7MB
- [x] P0: v8.2.0 릴리즈 — 89커밋 포함

### Completed (2026-02-19)
- [x] P2: Production QA 전체 통과 — 대시보드, AI 사이드바, 서버 카드, 페이지네이션, Cold Start 검증
- [x] P2: AI Rate Limit dailyLimit 50→100 — QA 테스트 중 소진 확인, Cloud Run 용량 대비 6.7% 안전 마진
- [x] P0: `/debug/*` timing-safe 인증 — string 비교→`timingSafeEqual` (타이밍 공격 방지)
- [x] P1: 429 응답 JSON 파싱 방어 — `response.json()` try-catch 래핑 (non-JSON proxy 방어)
- [x] P1: rate-limiter 주석 불일치 수정 — 실제 값(10회/분, 100회/일)과 일치
- [x] P1: wake-up 엔드포인트 rate limiter 추가 — 무인증 남용 방지
- [x] P2: ColdStartErrorBanner error prop 변경 시 retry 상태 리셋
- [x] P2: useHybridAIQuery retry 카운트 표시를 실제 maxRetries로 통일
- [x] P2: useAsyncAIQuery JSDoc timeout 기본값 수정 (120000→15000)
- [x] P2: wake-up/route HTTP 204 스펙 준수 (body 제거)
- [x] P2: rate-limiter `x-vercel-forwarded-for` 우선 사용
- [x] P2: supervisor-routing `console.log`→`logger` 마이그레이션
- [x] P3: server.ts `verifyApiKey()` 헬퍼 추출 (DRY, 3중 복사→1)
- [x] P3: rate-limiter 미사용 interface 필드 제거
- [x] P3: useAsyncAIQuery `||`→`??`, type assertion 제거
- [x] P3: wake-up/route Retry-After 헤더 추가
- [x] P3: useHybridAIQuery dead `resumeEnabled` useState→const
- [x] P3: supervisor-routing/single-agent stale `@version` JSDoc 제거
- [x] P3: Storybook play function + argTypes 추가 (11 stories)

### Completed (2026-02-18)
- [x] P2: Cloud Run E2E 파이프라인 완성 — contract test에 supervisor/stream/v2 입력검증+인증 계약 추가 (LLM 0회), 리팩토링 계획서 3개 archive 이동
- [x] P2: 기능 책임 기반 실동작 재검증 수행 — Vercel HTTP 스모크(핵심 경로/상태코드), 로컬 `test:quick` 196 PASS 근거 확보
- [x] P2: Vercel 크리티컬 브라우저 검증 교차 실행 — 샌드박스 `SIGTRAP` 원인 분리, 비샌드박스 `25/25 PASS (2.8m)` 확인
- [x] P2: Vercel E2E 저부하 기본값 전환 — `playwright.config.vercel.ts`(desktop default, mobile opt-in, retries 축소), `test:vercel:*:mobile` 스크립트 분리
- [x] P2: AI 풀스크린 실동작 검증 — `ai-fullscreen.spec.ts` 9/9 PASS (1.8m)
- [x] P2: AI NLQ 단건 검증 — 실패 원인 분리 완료 (`Failed to create job: 429`, 코드 결함 아님)
- [x] P2: AI NLQ 안정성 완화 패치 — `/api/ai/jobs` 429 감지, `Retry-After` 상한(2~15s), rate-limit 텍스트 감지 강화
- [x] P2: Playwright 테스트 호환성 수정 — `ai-supervisor-timeout.spec.ts` beforeEach 인자 시그니처 교정 후 단건 PASS
- [x] P2: CI 워크플로우 최적화 — schedule→workflow_dispatch 전환, detect-scope 조건부 테스트
- [x] P3: Biome 스키마 2.4.2 업그레이드 + renderAIGradientWithAnimation 단순화
- [x] P3: vercel MCP API key 전달 방식 수정 (env→args, v0.0.7 호환)
- [x] P3: MCP 전체 동작 테스트 8/8 정상 확인
- [x] P3: 프로젝트 문서 v8.1.0 현행화 (WBS, DoD, SRS, completion-review, status.md)
- [x] P1: AI Engine 핵심 4모듈 테스트 추가 (prompt-guard 24 + supervisor-routing 31 + error-handler 14 + text-sanitizer 22 = 91 tests)
- [x] P2: RAG 임베딩 모듈 통합 (`embedding.ts` + `embedding-service.ts` → 단일 모듈, local fallback + 3h 캐시 + 통계)
- [x] P2: CI 파이프라인 강화 — smoke `continue-on-error` 제거(차단형), `cloud-run-unit` job 신설, 계약 테스트 CI 추가
- [x] P3: 문서 갱신 — completion-review 95.3%, wbs 95.4% 반영
- [x] P3: 문서 정합성 재검증 — WBS/Completion 수치 불일치(95.0/95.4, 94% 표기, 카운트 편차) 정리
- [x] P2: 표준 완료(Option 2) 실환경 검증 — 무료티어 가드레일 + Cloud Run 저비용 스모크 + Vercel 데스크탑/모바일 50개 크리티컬 + NLQ 단건 통과

### Completed (2026-02-17)
- [x] P2: ToolSet 캐스팅 근본 수정 — `allTools: ToolSet` 타입 명시, `filterToolsByWebSearch` 단순화, `as ToolSet` 0개
- [x] P3: 루트 `@ai-sdk/groq` 제거 (cloud-run/ai-engine에서만 사용)
- [x] P3: 리팩토링 잔류 빈 디렉토리 4개 삭제
- [x] P3: Docker 빌드 캐시(4.2G) + npm/pip/node-gyp 캐시 + Playwright 구버전 정리 (총 10.3G)

### Completed (2026-02-16)
- [x] P1: Full Stack 관점 최종 검수 완료 (`completion-review.md` 96.8%)
- [x] P2: Frontend E2E 테스트 추가 (`ai-fullscreen.spec.ts`, `dashboard-ai-sidebar.spec.ts`)
- [x] P2: API Integration 테스트 추가 (`ai-supervisor.integration.test.ts`)
- [x] P2: NLQ E2E 수동 테스트 추가 (`ai-nlq-vercel.manual.ts`)
- [x] P3: 성능/보안/평가 기준 수립 (Lighthouse, CSP, Promptfoo)
- [x] P3: WBS 최신화 (테스트 커버리지 반영, 실제 완성도 94.7% 달성)

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
| `wbs.md` | 운영 | 전체 진행률 ~95.4% (검수 95.3%), v8.1.0 현행화 완료 |

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

| Task | Priority | Status | Description |
|------|----------|--------|-------------|
| security-attack-regression-pack | P1 | Deferred | 보안 QA 체계 구축 (실운영형 공격 회귀팩) |
| ai-code-gate-input-policy | P1 | Deferred | Prompt 패턴 15개 방어 정책 운영화 |

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
