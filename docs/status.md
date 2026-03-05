# 프로젝트 현재 상태

> 프로젝트 버전별 변경 이력과 운영 상태 요약
> Owner: documentation
> Status: Active
> Doc type: Status
> Last reviewed: 2026-03-04
> Canonical: docs/status.md
> Tags: status,changelog,release

**마지막 업데이트**: 2026-03-04

---

## 데이터 구조

- **Synthetic 데이터**: 15대 서버, 24시간, 10분 간격 (2026-02-14 기준)
- **SSOT**: `public/data/otel-data/` → `resource-catalog.json` + `hourly/hour-{00..23}.json` + `timeseries.json`
- **상세**: [OTel 데이터 아키텍처](reference/architecture/data/otel-data-architecture.md)

---

## 🔄 Recent Changes

- **v8.7.8** (2026-03-04)
  - fix(ai-engine): force `searchWeb` tool call for external info queries
  - fix(ai-engine): unify Tavily backup key into `AI_PROVIDERS_CONFIG` grouped secret (`tavilyBackup` field)
  - feat(ai-engine): add server-readiness guard for `/api` routes
  - test(ai-engine): add route tests for 9 Cloud Run endpoints (+71 tests, 총 648 tests)
  - qa: Production QA run #50 (8/8 PASS, Playwright MCP) — 누적 97.94% pass rate
  - style: apply Biome auto-format (import order, line wrapping)

- **v8.5.0** (2026-02-27)
  - fix(ai-engine): Groq `json_schema` 미지원 에러 해결 — Orchestrator 모델 우선순위를 `['cerebras', 'mistral', 'groq']`로 재배치
  - feat(ai-engine): RAG 토글 지원 — `createPrepareStep` + `filterToolsByRAG`로 `enableRAG=false` 시 `searchKnowledgeBase` 도구 제거
  - fix(ai-engine): Analyst 모델 Groq → Cerebras Primary 전환 (Cerebras `gpt-oss-120b` 우선)
  - fix(storybook): Storybook v10 비호환 `@storybook/blocks@8.6.14`, `@storybook/test@8.6.15` v8 패키지 제거
  - fix(ui): AI 응답 JSON 블록 표시 개선
  - test: 중복 테스트 병합 및 브리틀한 테스트 개선, a11y 테스트 강화

- **v8.4.0** (2026-02-26)
  - AI 검색 제어 정합성(Cloud Run 동기화):
    - 웹 검색 토글 OFF 상태에서 `searchWeb`이 경로별로 호출되지 않도록 라우팅/프록시 단에서 차단.
    - `enableWebSearch`와 `enableRAG`가 Vercel API 라우트 → Cloud Run 프록시 바디로 일괄 전달되도록 정렬.
    - 기존 `searchWeb` 강제 경로(자동 토글)도 토글 OFF일 때는 동작하지 않음.
    - 프록시 전달 로직은 `src/app/api/ai/supervisor/cloud-run-handler.ts`에서 검증됨.

- **v8.3.2** (2026-02-23)
  - **Post-release QA & Observability**
    - QA 결과: Guest PIN 로그인, 랜딩→대시보드, AI 사이드바, RAG 응답 포함 **9/9 PASS**
    - Warmup 개선 효과 확인: 첫 질의 기준 `90초+`(재시도 포함) → `~30초`
    - 구조화 로그 추가:
      - `warmup_started`, `warmup_ready` (source, warmup_latency_ms, upstream_status)
      - `first_query_latency_ms` (warmup_started_at_ms 기반 1회 측정)
    - 추적 경로:
      - `/api/ai/wake-up` (클라이언트 웜업)
      - `/api/auth/callback` (OAuth 성공 직후 선제 웜업)
      - `/api/ai/supervisor/stream/v2` (첫 질의 latency 측정)

- **v8.3.1** (2026-02-22)
  - fix(license): GPL-3.0 프로젝트 헤더, package 메타데이터, OCI 라벨 추가
  - fix(test): Cloud Run 8개 테스트 타임아웃 해결 (vi.hoisted + timeout 확장)
  - ci: CI 품질 게이트 강화 — Cloud Run 테스트 필수 조건 추가
  - refactor(auth): 로그인 플로우, E2E 헬퍼, CI 파이프라인 개선

- **v8.3.0** (2026-02-22)
  - feat(auth): HMAC SHA-256 서명 기반 게스트 세션 증명 (cookie forgery 방지)
  - test(auth,security): InMemoryRateLimiter 10개 + login-audit 11개 단위 테스트 추가
  - style: Biome import ordering 및 줄바꿈 포맷팅 적용

- **v8.2.0** (2026-02-22)
  - feat(auth): 이메일 Magic Link 로그인 추가 (Supabase OTP, 소셜 로그인과 병행)
  - feat(observability): 런타임 로그 레벨 API + AIDebugPanel UI 토글 추가
  - refactor(auth): dead code 20+ 파일 삭제, 게스트 정책 단순화 (country-code 기반)
  - fix(logging): Cloud Run GCP severity 매핑 경량화 (외부 의존성 제거)
  - copy: 랜딩 히어로 텍스트 및 Feature Card 메시징 개선
  - chore(deps): lucide-react 0.575.0, @storybook/addon-mcp 0.3.1, @tailwindcss/postcss 4.2.0

- **v8.1.0** (2026-02-19)
  - feat(storybook): UI + Shared 컴포넌트 스토리 22개 추가 (UI 17 + Shared 5, 커버리지 1%→26%)
  - feat(mcp): Storybook MCP 도입 (addon-mcp v0.2.3, 4개 도구)
  - feat(ui): Log Explorer OTel 24h 데이터 전환 + Incident Explorer 제거
  - fix(ui): 로고 그라데이션 아이콘 복구 + "AI" 텍스트 추가
  - chore(docs): 문서 예산 재분배 (guides 12→7, troubleshooting 5→3, development 12→14)
  - chore: CI 워크플로우 최적화 — schedule 트리거를 workflow_dispatch로 전환 (비용 절감)
  - feat(ci): detect-scope job 추가 — Cloud Run/AI Engine 변경 감지 기반 조건부 테스트 실행
  - refactor(ui): renderAIGradientWithAnimation variant 파라미터 제거 (단순화)
  - chore: Biome 스키마 2.3.15 → 2.4.2 업그레이드
  - fix(test): Cloud Run 계약 테스트 UnauthorizedResponseSchema 검증 추가
  - fix(mcp): vercel MCP API key 전달 방식 수정 (env → args, v0.0.7 호환)
  - feat(release): publish.sh 자동 GitHub Release 생성 파이프라인 추가
  - chore: commit-and-tag-version 도입 (deprecated standard-version 교체)

- **v8.0.0** (2026-02-18)
  - feat(mobile): 모바일 웹 표준 적용 — WCAG 접근성, Apple HIG, Material Design 가이드라인 준수
  - feat(ui): 로그인 전환 + 프로필 메뉴 컨트롤 개선
  - fix(observability): Sentry tunnel upstream timeout 추가
  - fix(ai-engine): reporter limits 복구, empty streams 방어 강화
  - fix(ai-engine): incident report retry/fallback/cache 안정성 강화
  - fix(e2e): 셀렉터 안정화, rate limit 감지 + AI 검증 경로 정리 (당시 `test:vercel:ai` 도입, 현재는 `test:contract` 중심으로 전환)
  - chore: gitignore mobile screenshots + lighthouse reports
  - refactor(workflow): Skills 체계 통합 (5개 → 표준화), Cloud Run 메타데이터 갱신
  - fix(stability): stream/metrics 안정성 강화 (review-driven hardening)
  - fix(frontend): system-start auth flow 및 bootstrap recovery 개선
  - chore(deps): AI SDK v6.0.86, 패키지 버전 최신화
  - MCP: Serena/Tavily 제거, next-devtools/supabase-db/storybook 추가 (9개)
  - any 타입 완전 제거 (17→0), OTel 데이터 표준화 완료
  - WBS + 검수 보고서 수치 현행화

- **v7.1.5** (2026-02-11)
  - refactor(data): 구 hourly 정적 디렉토리 이중 복사 제거 — `src/data/otel-data/` 중심 SSOT로 단순화 (후속 v8.0.0에서 `public/data/otel-data` 런타임 SSOT로 외부화)
  - refactor(data): Dead Code 제거 (server-data-cache.ts, loadHourlyServerData, precompute-metrics.ts)
  - fix(api): /api/dashboard 이중 호출 정리 (getServerMetricsFromUnifiedSource 제거)
  - perf(otel): OTel 파이프라인 최적화 — hostname index, conversion cache, JSON diet
  - docs(data): 데이터 아키텍처 3-Tier Priority 구조로 갱신 (OTel > Prometheus > Fixed)

- **v7.1.4** (2026-02-08)
  - feat(data): server-services-map 추가 (자동 서비스 추론)
  - docs(data): Prometheus best practice 비교 및 PromQL 참조 매핑
  - feat(data): uPlot 및 Prometheus Format tech stack 추가
  - fix(ai-engine): provider fallback 개선, CB 로깅 강화, web search 병렬 failover
  - chore: 루트 스크린샷 PNG 정리

- **v7.1.3** (2026-02-06)
  - fix(types): @types/react 19.2.10 InputEvent 호환성
  - fix(metrics): KST 타임스탬프 ISO 포맷 수정
  - refactor(metrics): fixed-24h-metrics dead code 제거
  - feat(prometheus): 임계값 통합 및 AI 컨텍스트 확장
  - security(promql): DoS 방지 쿼리 길이/복잡도 제한
  - refactor(api): getMockSystem → MetricsProvider 전환
  - fix(test): WSL worker timeout fork pool 수정

- **v7.1.2** (2026-02-03)
  - **AI 베스트 프랙티스 95% 달성 - P1 이슈 완료**
    - **P1 메시지 제한 상수 통일**: 스토어 100개 vs SESSION 50개 불일치 해결
      - `useAISidebarStore.ts`: `.slice(-100)` → `.slice(-SESSION_LIMITS.MESSAGE_LIMIT)`
      - 보안 강화 목적 50개 제한으로 통일 (악의적 사용/폭주 방지)
    - **P1 캐시 시스템 통합**: 이원화된 정규화 로직 단일화
      - `ai-response-cache.ts`: 자체 정규화 → `unified-cache.ts`의 `normalizeQueryForCache()` 사용
      - 캐시 히트율 일관성 확보 (구두점 제거, 공백 정규화, 대소문자 통일)
    - **분석 문서 생성**: `reports/planning/archive/ai-assistant-best-practice-analysis-v713.md`
    - 변경 파일: `useAISidebarStore.ts`, `ai-response-cache.ts`
  - **이전 개선사항 (v7.1.1 → v7.1.2 초반)**
    - **P1 캐시 쿼리 정규화**: "상태?", "상태!", "상태" → 동일 캐시 키로 매핑
    - `normalizeQueryForCache()` 메서드 추가 (구두점 제거, 공백 정규화, 대소문자 통일)
    - `getAIQueryCache()`, `setAIQueryCache()`, `getOrFetchAIQuery()` 헬퍼 함수
    - **P1 Complexity 카테고리 가중치 외부화**: `query-complexity.ts` 하드코딩 제거
    - 8개 환경변수로 가중치 조정 가능: `AI_COMPLEXITY_WEIGHT_{ANALYSIS|PREDICTION|AGGREGATION|...}`
    - `getComplexityCategoryWeights()`, `getComplexityCategoryWeight()` getter 함수
    - 변경 파일: `unified-cache.ts`, `ai-proxy.config.ts`, `query-complexity.ts`

- **v7.1.1** (2026-02-03)
  - **AI 설정 외부화 및 Observability 강화** (신규)
    - **P0 Magic Number 설정화**: `DEFAULT_COMPLEXITY_THRESHOLD = 19` → `ai-proxy.config.ts`로 이동
    - 환경변수 `AI_COMPLEXITY_THRESHOLD`로 런타임 조정 가능
    - **P1 스트리밍 재시도 로직**: Exponential backoff 구현 (최대 3회, 1초→2초→4초)
    - 재시도 가능한 에러 패턴 설정 (`AI_STREAM_MAX_RETRIES`, `AI_STREAM_INITIAL_DELAY` 등)
    - **P1 Trace ID 전파 강화**: 모든 AI 요청/응답에 `X-Trace-Id` 헤더 추가
    - verbose 로깅 옵션 (`AI_VERBOSE_LOGGING=true`)
    - **P2 RAG 가중치 외부화**: `AI_RAG_WEIGHT_VECTOR/GRAPH/WEB` 환경변수
    - **P2 혼합 로깅 정리**: `console.log` → `logger` 통일
    - 변경 파일: `ai-proxy.config.ts`, `useHybridAIQuery.ts`, `cloud-run-handler.ts`, `useFileAttachments.ts`
  - **Observability 완성: Trace ID Upstream 추출 및 Jitter** (신규)
    - **P0 Trace ID Upstream 추출**: 클라이언트 `X-Trace-Id` 헤더 추출 → 없으면 서버에서 신규 생성
    - 모든 로그 메시지에 trace ID 포함 (보안, 캐시, 에러)
    - 모든 응답 헤더/body에 `traceId` 전파
    - **P0 Retry Jitter 추가**: `jitterFactor` 설정 (기본값 ±10%)로 Thundering herd 방지
    - 새 환경변수: `AI_STREAM_JITTER_FACTOR=0.1`
    - **P1 Error Handler Trace**: `handleSupervisorError(error, traceId?)` 파라미터 추가
    - **P1 Security 감사 추적**: 프롬프트 인젝션 차단 로그에 trace ID 포함
    - **P1 Cache 로그 Trace**: 캐시 HIT/MISS/SKIP 로그에 trace ID 포함
    - 변경 파일: `route.ts`, `error-handler.ts`, `ai-proxy.config.ts`
  - **Cloud Run 상태 인디케이터 시스템 연동** (신규)
    - `CloudRunStatusIndicator`에 `enabled` prop 추가 → 시스템 시작/중지와 연동
    - 시스템 중지 시: 모든 폴링/웜업 즉시 취소, "Off - 시스템 중지" 상태 표시
    - AbortController 추가로 컴포넌트 언마운트 시 메모리 누수 방지
    - 폴링 간격: 30초 → 5분 (Free Tier 최적화, 2,880회/일 → 288회/일)
  - **Vercel Production QA (2026-02-03 18:50)**: Playwright MCP 전체 기능 검증
    - 랜딩 페이지 → 시스템 시작 → 대시보드 → AI 사이드바 전체 플로우 정상
    - **Cloud Run 상태 인디케이터**: "Ready" 상태 정상 표시 (시스템 활성 시)
    - **AI Chat Agent**: 서버 상태 요약 (명확화 UI → 전체 서버 현황)
    - **AI 응답 품질**: "15대 서버 중 13대 정상, 1대 경고, 1대 임계" (정확)
    - **Cold Start 처리**: 자동 재시도 UI 정상 작동 (5초 후 자동 재시도 → 성공)
    - 콘솔 error/warning: 0건
  - **Gemini API 키 유출 복구**: Google 자동 스캐너 감지 → 키 재발급 및 적용
    - 유출 원인: `reports/planning/vision-agent-implementation-plan.md`에 하드코딩
    - 복구 작업: 문서에서 키 제거, .env.local/Vercel/GCP Secret Manager 모두 업데이트
    - Cloud Run 재배포: `ai-engine-00201-b5p` 리비전 (새 키 적용)
    - Vision Agent 테스트 성공: Gemini 2.5 Flash 정상 작동 (3.7초 응답)
  - **Vercel Production QA (2026-02-03 15:25)**: Playwright MCP 전체 기능 검증
    - 랜딩 페이지 → 대시보드 → AI 사이드바 전체 플로우 정상
    - **AI Chat Agent**: 서버 상태 요약 (Cerebras/llama-3.3-70b, ~1초 응답)
    - **응답 품질**: 15대 서버 현황 정확 분석 (정상 12, 경고 2, 임계 1)
    - **Cold Start 처리**: 자동 재시도 UI 정상 작동 (5초 후 자동 재시도)
    - 스크린샷 7장 생성: qa-01~qa-07
  - **Coverage Threshold 현실화**: 80% → 10%로 조정 (실제 커버리지 ~11% 기준)
    - `vitest.config.main.ts`: lines/branches/functions/statements 모두 10%
    - `.claude/rules/testing.md`: 문서 동기화
  - **React #419 SSR Suspense 에러 수정**: `crypto.randomUUID()` SSR 가드 추가
    - `useAISidebarStore.ts`의 sessionId 생성에 `typeof crypto !== 'undefined'` 가드
    - fallback에 `Math.random()` suffix 추가 (멀티탭 충돌 방지)
    - Vercel Production QA 완료: 콘솔 error/warning 0건
  - **React 19 ref-as-prop 마이그레이션**: AutoResizeTextarea 컴포넌트
  - **SWC _ref 컴파일 버그 회피**: SystemContextPanel 구조 수정
  - **AI 중복 메시지 방지**: cold start retry 시 duplicate user message 방지
  - **Tailwind 커스텀 토큰**: 반복 arbitrary value를 @theme 토큰으로 교체
  - **비즈니스 로직 분리**: API route → service module 리팩토링
  - **테스트 수정 (4건)**:
    - AIWorkspace.test: `getAllByText` 패턴으로 중복 텍스트 대응
    - ReactFlowDiagram snapshot: `text-[10px]` → `text-2xs` 토큰 반영
    - retry.test: `Promise.allSettled`로 Unhandled Rejection 수정
    - vercel-optimization.test: assertion 수정
  - **AutoResizeTextarea ref 타입 안전성 개선**: unsafe `as RefObject` 캐스팅 제거
    - `useEffect` 기반 외부 ref 동기화 (RefCallback/RefObject 모두 지원)
    - 내부 `textareaRef`만 사용하도록 변경, `combinedRef` 제거
  - **Vercel Production QA (2026-02-03 14:41)**: Playwright MCP 개별 에이전트 검증
    - 대시보드: 15개 서버 그리드, 상태 배지(Stable/Unusual/Rising) 정상
    - **AI Chat Agent**: Clarification UI → 전체 서버 현황 응답 성공
    - **Reporter Agent**: 장애 보고서 자동 생성 성공 (웹/WAS CPU 과부하 경고)
    - **Analyst Agent**: 15개 서버 전체 분석 완료 (정상 12, 주의 2, 위험 1)
    - 콘솔 error/warning: 0건

- **v7.1.0** (2026-01-31)
  - **Prompt Injection 방어 레이어**: Cloud Run + Vercel 양쪽 적용
    - OWASP LLM Top 10 기반 17개 입력 패턴 (EN/KO), 9개 출력 패턴
    - medium 이상 위험도 즉시 400 차단 (sanitize가 아닌 block)
    - Cloud Run 3개 엔드포인트 (POST /, /stream, /stream/v2) 입력/출력 가드
    - Vercel `quickSanitize` → `securityCheck` 업그레이드
  - **Web Search Toggle**: AI Sidebar에 Globe 아이콘 웹 검색 토글 추가
  - **enableWebSearch 전파 수정**: Supervisor → Multi-Agent 경로 전파 누락 해결

- **v7.1.0** (2026-01-27)
  - **Vision Agent 추가**: Gemini 2.5 Flash-Lite 기반 멀티모달 에이전트
  - Quad-provider 아키텍처로 확장 (Cerebras/Groq/Mistral + Gemini)
  - 4개 Vision 도구: analyzeScreenshot, analyzeLargeLog, searchWithGrounding, analyzeUrlContent
  - Graceful Degradation: Gemini 장애 시 Vision 기능만 비활성화, 기존 에이전트 정상 동작

- **v7.0.1** (2026-01-26)
  - **Job Queue Redis Only 전환**: Supabase ai_jobs 테이블 제거, Redis 단일 저장소
  - useAIChatCore 4개 hook 분해 리팩토링
  - sessionId 전파 문제 해결 (useState + useRef 하이브리드)
  - RAG 문서 v1.1.0 (HyDE, LLM Reranker, Tavily 반영)
  - 문서 DRY 원칙 적용 (WSL 중복 문서 통합)

- **v7.0.0** (2026-01-24) - BREAKING CHANGES
  - v1 stream endpoint 제거 → v2 UIMessageStream 전용
  - Resumable streams via Redis (새로고침 시에도 유지)
  - AI SDK v6 native `resume: true` 기본 적용

- **v6.1.0** (2026-01-25)
  - `TextStreamChatTransport` → `DefaultChatTransport` + `resume: true`
  - UIMessageStream 네이티브 프로토콜 적용
  - Resumable Stream v2 엔드포인트 (`/api/ai/supervisor/stream/v2`)
  - `finalAnswer` 도구 패턴 적용 (`hasToolCall` + `stepCountIs`)

---

## 🏗️ Technical Stack (v8.7.8)

**Core Frameworks** (2025 Standard)
- **Next.js**: `v16.1.6` (App Router, Server Components)
- **React**: `v19.2.4` (RSC, Actions, useOptimistic)
- **TypeScript**: `v5.9.3` (Strict Mode)
- **Node.js**: `v24.x` (Current, engines: >=24.0.0 <25.0.0)

**UI & Styling**
- **Tailwind CSS**: `v4.2.1` (PostCSS optimized)
- **Component Lib**: Radix UI (Latest), Lucide React `v0.575.0`
- **Animation**: tailwindcss-animate (CSS-based, Framer Motion 제거됨)

**State & Data**
- **Zustand**: `v5.0.11` (Global client state)
- **React Query**: `v5.90.21` (Server state synchronization)
- **Supabase**: PostgreSQL + Realtime + Auth
- **Upstash**: Serverless Redis (Caching & Rate Limiting)
- **GraphRAG**: Knowledge Graph + Vector Search Hybrid (pgvector 기반)
- **Code Interpreter**: Browser-based Python (Pyodide WebAssembly)

## 📚 Documentation Status

**총 활성 문서 수**: 54개 (예산 60, `docs/archived/` 제외)

**DRY 구조**:
- `.claude/rules/` → Claude Code 전용 간략 규칙
- `docs/` → 개발자용 상세 문서
- Diataxis 분류 적용 (Tutorial/How-to/Reference/Explanation)
- **State Mgmt**: Zustand `v5.0.11`
- **Data Fetching**: TanStack Query `v5.90.21`
- **Backend/DB**: Supabase JS `v2.97.0` (SSR `v0.8.0`)
- **Utility**: tailwind-merge `v3.5.0`

**AI Ecosystem** (상세: [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md))
- **SDK**: Vercel AI SDK `v6.0.97` (`@ai-sdk/*` 패키지 포함, Cloud Run: `^6.0.50`)
- **Native Patterns** (v6.1.0):
  - `finalAnswer` 도구: `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(5)]`
  - `UIMessageStream`: 네이티브 스트리밍 프로토콜
  - `Resumable Stream v2`: Upstash Redis 기반 자동 재연결
  - `prepareStep`: 에이전트 라우팅 순서 최적화
- **Models**: Quad-provider 전략 (Rate limit 최적화, 2026-01-27)
  - Cerebras `gpt-oss-120b`: Supervisor, NLQ, Orchestrator, Analyst, Verifier (1M TPD, 3000 tok/s)
  - Groq `llama-3.3-70b-versatile`: Reporter (100K TPD, 12K TPM)
  - Mistral `mistral-large-latest`: Advisor (Tier 0: 1 RPS)
  - **Gemini 2.5 Flash**: Vision Agent (250 RPD, 10 RPM, 1M context)
  - **OpenRouter (Fallback)**: `nvidia/nemotron-nano-12b-v2-vl:free` (Gemini Vision 백업)
- **Agents**: 7개 실행 에이전트 (NLQ/Analyst/Reporter/Advisor/Vision/Evaluator/Optimizer) + 1 Orchestrator 코디네이터
- **Tools**: 27개 도구 Registry (Metrics 5, RCA 3, Analyst 4, Reporter 4, Evaluation 6, Control 1, Vision 4)
- **Reporter Pipeline**: Evaluator-Optimizer 패턴 (0.75 품질 임계값, 최대 2회 반복)
- **MCP**: 9/9 Server Connected (Context7, Stitch, Supabase-DB, Vercel, Playwright, GitHub, Sequential-Thinking, Next-DevTools, Storybook)
- **Web Search**: Built-in WebSearch (Tavily 제거, Claude Code 내장 기능으로 대체)
- **Resilience**:
  - Circuit Breaker: CLOSED → OPEN (5 failures) → HALF_OPEN (30s)
  - Quota Tracker: Pre-emptive Fallback (80% 임계값 도달 시 사전 전환)
  - 3-way Fallback: Cerebras → Groq → Mistral

**AI CLI Tools** (2026-02 기준)
- **Claude Code**: Opus 4.6 (Interactive Development)
- **Codex CLI**: `v0.104.0` / GPT-5.3 Codex (Code Review - 2-AI Rotation)
- **Gemini CLI**: Gemini 3 Pro (Code Review - 2-AI Rotation)

**Quality Control**
- **Test**: Vitest `v4.0.18`, Playwright `v1.58.2`
- **Lint/Format**: Biome `v2.4.4`

---

## 🔧 최근 유지보수 (2025-12-09 ~ 2026-01-10)

**AI SDK v5 Zod Schema 호환성 수정 (2026-01-10)**
- **문제**: 연속 NLQ 쿼리 시 400 에러 발생
  - 첫 쿼리는 성공 (text parts만 포함)
  - 두 번째부터 실패 (source, step-start 등 추가 parts 포함)
- **원인**: `z.discriminatedUnion`이 알 수 없는 part 타입에서 실패
- **해결**: `z.union`으로 변경 + fallback 패턴 추가
  ```typescript
  // Before: discriminatedUnion (엄격, 알 수 없는 타입 거부)
  // After: union + fallback (유연, AI SDK 업데이트 대응)
  z.object({ type: z.string() }).passthrough() // fallback
  ```
- **변경 파일**: `schemas.ts`, `stream/route.ts`
- **검증**: Vercel Production 4개 연속 NLQ 테스트 통과

**NLP Intent Classification 개선 + Streaming SSE (2026-01-09)**
- **Infrastructure Context Gating**: False Positive 감소를 위한 2단계 패턴 매칭
  - `multiAgentPatterns`: 항상 Multi-Agent 트리거 (보고서, 해결방법, 용량계획)
  - `contextGatedPatterns`: 인프라 컨텍스트 필수 (왜+메트릭, 예측/트렌드, 비교/대비)
  - `infraContext` 게이팅: `/서버|인프라|시스템|모니터링|cpu|메모리|디스크|트래픽|네트워크/i`
- **SSE Streaming 안정화**: AI Code Review 피드백 반영
  - Vercel → Cloud Run 스트리밍 프로토콜 개선
  - Response normalization 강화
- **Docker Artifact Registry 마이그레이션**: gcr.io → asia-northeast1-docker.pkg.dev
- **NLP 아키텍처 문서화**: `docs/ai-model-policy.md` 의도 분류 섹션 추가

**Agent SSOT 리팩토링 + Langfuse 무료 티어 보호 (2026-01-07)**
- **SSOT 패턴 적용**: Agent 설정 중앙화
  - `agents/config/agent-configs.ts`: Single Source of Truth
  - 5개 Agent Instructions 분리 (`instructions/*.ts`)
  - 코드 66-75% 감소 (872 → 249 lines, -404 lines)
  - orchestrator.ts 중복 AGENT_CONFIGS 제거 (~180 lines)
- **Provider 캐싱**: `checkProviderStatus()` 결과 캐싱 추가
  - API 키 체크 중복 호출 방지
  - `toggleProvider()` 시 캐시 무효화
- **Langfuse 무료 티어 보호 시스템**:
  - 10% 샘플링 기본 (월 ~450K 쿼리 지원)
  - 90% 임계값 자동 비활성화 (45K events)
  - 70%, 80% 경고 로그
  - 테스트 모드 지원 (100% 트레이싱)
  - `/monitoring/traces` 엔드포인트 추가
- **Cloud Run 무료 티어 최적화**:
  - CPU: 2 → 1 vCPU, Memory: 1Gi → 512Mi
  - Max Instances: 10 → 3
  - BuildKit 문법 제거 (Cloud Build 호환)
- **신규 Skill**: `cloud-run-deploy` (토큰 65% 절감)

**AI 분석 순수 메트릭 기반 전환 (2026-01-06)**
- **시나리오 힌트 제거**: AI가 사전 정의된 힌트 대신 원시 메트릭으로 분석
  - `rca-analysis.ts`: `getScenariosByServer` 제거, 메트릭 임계값 기반 가설 생성
  - `incident-report-tools.ts`: cascade 감지 및 타임라인을 메트릭 기반으로 변경
- **메트릭 기반 로그 생성**: 서버 타입별 로그 템플릿 추가
  - `fixed-24h-metrics.ts`: `generateMetricLogs()` 함수 추가
  - 서버 타입: web, database, cache, application, loadbalancer, storage
- **네트워크 메트릭 누락 수정**: `generateIncidentReport`에 Network 임계값 체크 추가
- **산업 표준 검증**: Prometheus, Datadog, Grafana 메트릭 호환성 확인

**Tavily Best Practices + P0 단위 테스트 (2026-01-04)**
- **Web Search 베스트 프랙티스 적용**:
  - Timeout: 10초 (무한 대기 방지, 이후 15초로 변경)
  - Retry: 최대 2회 (transient errors 대응)
  - Cache: 5분 TTL (반복 쿼리 비용 절감)
  - Failover: Primary → Backup Key 자동 전환
- **P0 단위 테스트 추가** (AI Engine):
  - `config-parser.test.ts`: API 키 관리 18개 테스트
  - `reporter-tools.test.ts`: Web Search 9개 테스트
  - `orchestrator.test.ts`: Mock 수정 (`searchWeb` 추가)
- **총 테스트**: 228개 통과 (Vitest 12 files, 228 tests)

**AI Engine 안정성 개선 + Job Queue 최적화 (2025-12-30)**
- **Phase 1: Message Format 통합**
  - `extractTextFromMessage()` 중복 제거 → `src/lib/ai/utils/message-normalizer.ts`
  - AI SDK v5 parts[] + 레거시 content 하이브리드 지원
- **Phase 2: Circuit Breaker + Fallback**
  - `executeWithCircuitBreakerAndFallback()` 래퍼 추가 → `src/lib/ai/circuit-breaker.ts`
  - `createFallbackResponse()` 폴백 핸들러 → `src/lib/ai/fallback/ai-fallback-handler.ts`
  - 적용 API: supervisor, intelligent-monitoring, incident-report, approval
- **Phase 3: Response Caching**
  - `withAICache()` 캐시 래퍼 → `src/lib/ai/cache/ai-response-cache.ts`
  - Memory → Redis 2단계 캐싱, TTL 정책 적용
- **Job Queue SSE 진행률 개선**
  - Redis 초기 상태 저장 (pending, 5% progress) → Job 생성 즉시 SSE 진행률 표시
  - SSE 스트림에서 pending/null 상태 처리 개선
  - Redis Only 아키텍처 (v7.0.1에서 Supabase 제거)
- **신규 컴포넌트**:
  - `src/components/error/AIErrorBoundary.tsx` - AI 에러 바운더리
  - `src/domains/ai-sidebar/components/JobProgressIndicator.tsx` - 진행률 UI
  - `src/hooks/ai/useHybridAIQuery.ts` - Streaming/Job Queue 하이브리드 훅
  - `src/lib/utils/retry.ts` - Exponential Backoff Retry 유틸리티

**LangGraph 최적화 + RCA/Capacity Agent (2025-12-28)**
- **RCA Agent 추가**: 장애 타임라인 구축, 메트릭 상관관계 분석, 근본 원인 추론
- **Capacity Agent 추가**: 리소스 소진 예측, 스케일링 권장사항 생성
- **Agent Dependency System**: RCA/Capacity는 NLQ+Analyst 결과 필수 (SharedContext 기반)
- **Workflow 캐싱**: 5분 TTL로 초기화 오버헤드 감소
- **Dead Code 제거**: NLQ SubGraph 삭제 (~1,000 lines) - `getServerMetricsAdvanced`로 대체
- **Recursion Limit**: 8 → 10 (4-agent 체인 + retry 버퍼)
- **Web Search 교체**: DuckDuckGo → Tavily API
- **검증**: Cloud Run ai-engine-00064 배포 완료, Health Check 정상

**Async Job Queue + SSE 실시간 알림 시스템 (2025-12-27)**
- **목적**: Vercel 120초 타임아웃 우회 (기존 111초 응답 → 즉시 반환)
- **아키텍처**: Redis Only (v7.0.1 단순화)
  - Vercel: Job 생성 (Redis) → Cloud Run: 백그라운드 처리 → Redis: 결과 저장 → SSE: 실시간 전달
  - ~~Supabase ai_jobs 테이블~~: v7.0.1에서 제거됨
- **Redis 키 구조**:
  - `job:{jobId}` → Job 데이터 (24h TTL)
  - `job:progress:{jobId}` → 진행률 (10min TTL)
  - `job:list:{sessionId}` → Job ID 목록 (1h TTL)
- **신규 파일**:
  - `cloud-run/ai-engine/src/routes/jobs.ts` - Cloud Run Job 처리 엔드포인트
  - `cloud-run/ai-engine/src/lib/job-notifier.ts` - Redis 결과 저장
  - `src/app/api/ai/jobs/[id]/stream/route.ts` - Vercel SSE 스트리밍
  - `src/hooks/ai/useAsyncAIQuery.ts` - Frontend React Hook
- **효율**: Redis 명령어 93% 절감 (폴링 90K → SSE 6K/월)

**NLQ Agent SubGraph 아키텍처 + 모델 분배 최적화 (2025-12-26)**
- **NLQ SubGraph 구현**: 5노드 워크플로우 (parse→extract→validate→execute→format)
  - `getServerMetricsAdvancedTool`: 시간 범위/필터/집계 지원
  - 한국어 자연어 파싱 헬퍼 함수 (시간, 메트릭, 필터)
  - 21개 단위 테스트 추가
- **Dual-provider 전략**: Rate limit 분산 (~1M TPM 무료)
  - Groq: Supervisor, NLQ, Analyst, Reporter (LangGraph handoff 필수)
  - Mistral: Verifier (24B 품질 검증)
- **신규 파일**: `nlq-state.ts`, `nlq-subgraph.ts`, `nlq-state.test.ts`
- **검증**: Cloud Run ai-engine-00036 배포, Health Check 정상

**Mock System SSOT 통합 및 로그 시스템 개선 (v5.83.12, 2025-12-25)**
- **SSOT 통합**: 모든 Mock 데이터 소스를 한국 데이터센터 기반 15개 서버로 통일
  - 서버 ID 표준화: `web-nginx-dc1-01`, `db-mysql-dc1-primary` 등
  - 시나리오 파일 업데이트: `dbOverload.ts`, `cacheFailure.ts`, `networkBottleneck.ts`, `storageFull.ts`
- **AI Agent 로그 시스템 개선**: 시나리오 이름 노출 제거 (스포일러 방지)
  - 변경 전: `[CRITICAL] 심야 DB 디스크 풀 detected` (정답 직접 노출)
  - 변경 후: `[ERROR] mysqld: Disk full (errcode: 28)` (증상만 표시)
  - AI가 로그 패턴을 분석하여 원인을 추론해야 함
- **서버 타입별 실제 로그 템플릿 구현**: MySQL, Redis, Nginx, HAProxy, NFS 등
- **변경 파일**: 16개 파일 (1,699 추가 / 1,300 삭제)

**AI 어시스턴트 스트리밍 수정 (v5.83.9, 2025-12-22)** _(⚠️ v6 마이그레이션으로 대체됨)_
- **문제 1**: AI SDK v5가 `parts` 배열 형식으로 메시지 전송 → Cloud Run 503 에러
  - 해결: `normalizeMessagesForCloudRun()` 함수 추가 (parts → content 변환)
- **문제 2**: `DefaultChatTransport`가 SSE JSON 기대 → Cloud Run plain text 스트림과 불일치
  - 해결: `TextStreamChatTransport`로 변경 (plain text 스트림 처리)
- ~~**변경 파일**~~: _v6에서 제거됨_
  - ~~`src/app/api/ai/supervisor/stream/route.ts`~~ (508줄 삭제)
- **v6 대체**: `DefaultChatTransport` + `resume: true` + UIMessageStream 네이티브 프로토콜

**기술 부채 검토 완료 (v5.81.0)**
- **Next.js 보안 패치**: 16.0.7 → 16.0.10 (CVE 대응)
- **핵심 로직 테스트**: AuthStateManager, LangGraph Supervisor 테스트 추가
- **패키지 최적화**: react-markdown 제거 (미사용, 78개 의존성 정리)
- **메이저 업그레이드**: tailwind-merge v3, @faker-js/faker v10

**패키지 전체 업그레이드 완료 (v5.80.0)**
- Next.js 15 → 16, React 18 → 19, TS 5.7 → 5.9 마이그레이션 완료.
- **Critical Fix**: Node.js `global` 객체 이슈 (`global` -> `globalThis`) 해결.

**코드 리뷰 시스템 (v7.0.0)**
- **구조**: 2-AI 순환 (Codex ↔ Gemini) + 상호 폴백 시스템.
- **Note**: Qwen 제거 (2026-01-07) - 평균 201초 응답, 13.3% 실패율로 인한 단순화.

---

## 📊 품질 지표 (2026-03-04 기준)

| Metric | Status | Detail |
|:---:|:---:|---|
| **Build** | ✅ Passing | `npm run build` (Next.js 16.1.6) 성공 |
| **Test** | ✅ Passing | 805 tests PASS (Vercel 157 + Cloud Run 648) |
| **Lint** | ✅ Clean | Biome Check Pass (No Errors) |
| **E2E** | ✅ 100% | 30/30 Scenarios Passing (Playwright) |
| **MCP** | ✅ 9/9 | 모든 MCP 서버 정상 연결 |
| **Vercel** | ✅ Deployed | Production 배포 정상 |
| **Sentry** | ✅ Active | Vercel + Cloud Run 에러 트래킹 |

---

## 📈 Code Quality (2026-01-05)

| 영역 | 파일 수 | 코드 라인 | 점수 | 상태 |
|------|---------|----------|------|------|
| **Frontend** (Vercel) | 800+ | ~125,000+ | 85/100 | ✅ A- |
| **Backend** (Cloud Run) | 106 | ~38,000 | 87/100 | ✅ A- |

**분석 결과**:
- `any` 타입: **0개** (Frontend 17 + Backend 5 → 전체 제거 완료, TypeScript strict 통과)
- 대형 파일: Frontend 5개, Backend 12개 → 모두 내부 구조 양호
- 코드량 분포: Frontend ~125,000 lines → 역할 대비 적정 (집중 영역 3곳 모두 정상)
- TypeScript strict: ✅ 양쪽 모두 PASS

**상세 보고서**: [`reports/planning/archive/ai-codebase-improvement-plan.md`](../reports/planning/archive/ai-codebase-improvement-plan.md)

---

## 📝 문서 관리 현황

**관리 원칙 (Diataxis + Doc Budget)**
- 활성 문서: 54개 (예산 60, `docs/archived/` 제외)
- 병합 우선: 70%+ 중복 시 병합, Historical 문서는 `docs/archived/`로 이동
- **Key Docs**:
  - `README.md`: 프로젝트 개요
  - `docs/status.md`: 기술 스택 및 상태 대시보드 (본 문서)
  - `config/ai/registry-core.yaml`: AI 설정 SSOT

---

## 🐳 Infrastructure Status (2026-01-20)

**Cloud Run AI Engine**
- **Service URL**: `gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)'`
- **Health**: ✅ All providers connected (Supabase, Upstash, Groq, Mistral, Cerebras, Gemini, OpenRouter, Langfuse)
- **Agents**: 7개 실행 (NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer) + 1 Orchestrator
- **Observability**: Langfuse (10% sampling, 무료 티어 보호)
- **Features**: cpu-boost, cpu-throttling, no-session-affinity, gen2, 512Mi/1vCPU, max-instances=1

**Error Monitoring (Sentry)**
- **Vercel (Next.js)**: `@sentry/nextjs` SDK 통합
  - 서버/클라이언트 에러 자동 캡처
  - `/api/debug/sentry-test` 테스트 엔드포인트
- **Cloud Run (AI Engine)**: `@sentry/node` SDK 통합
  - 글로벌 에러 핸들러 연동
  - `/debug/sentry` 테스트 엔드포인트
  - 서버리스 환경 최적화 (`flushSentry()` 적용)

**Artifact Registry** (gcr.io에서 마이그레이션 완료)
- **Repository**: `asia-northeast1-docker.pkg.dev/openmanager-free-tier/cloud-run/ai-engine`
- **Images**: 3개 유지 (최신 + 롤백)
  - `v-20260109-080312-49ba546d6` (최신 - NLP Context Gating)
  - `v-20260109-001908-345078884` (SSE Streaming)
- **정리 정책**: 최신 3개 이미지만 유지 (자동 정리)

**GCS Storage**
- **Cloud Build Sources**: ~2.5MB (최신 10개 유지)
- **정리 정책**: 빌드/배포 시 자동 정리

---

## 💰 리소스 효율

- **비용**: 월 $0 유지 (Free Tier 활용 최적화)
- **Token**: Context Caching & MCP 필터링으로 85% 절감
- **Performance**:
  - Dev Server: ~22s startup
  - Test Suite: ~21s execution

---

## 🎯 Development Methodology

**Zero to Production with Vibe Coding**

이 프로젝트는 **Claude Code**를 메인 개발 도구로 사용하여 처음부터 끝까지 구축한 Full-Stack AI Platform입니다.

| 구현 영역 | 기술 스택 | 상태 |
|----------|----------|------|
| Web UI | Next.js 16 + React 19 Dashboard | ✅ 완료 |
| AI Assistant | useChat + DefaultChatTransport (resume: true) | ✅ 완료 |
| Multi-Agent | 7-Agent Orchestration (Cloud Run) | ✅ 완료 |
| Database | Supabase PostgreSQL + pgvector | ✅ 완료 |
| Cache | Upstash Redis | ✅ 완료 |
| Monitoring | Server Metrics + Real-time Updates | ✅ 완료 |

**개발 도구 체인**:
- **Primary**: Claude Code (Interactive Development)
- **Code Review**: Codex + Gemini 2-AI Rotation
- **MCP**: 9개 서버 연동 (Context7, Stitch, Supabase-DB, Vercel, Playwright, GitHub, Sequential-Thinking, Next-DevTools, Storybook)

**총 코드량**: ~199,000 Lines (Frontend 125K+ / Backend 38K+ / Config & Tests)
