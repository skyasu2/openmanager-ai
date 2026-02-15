# OpenManager AI v8.0.0 - WBS & 완성도 분석

> Owner: project-lead
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-15
> Tags: wbs,completion,audit,retrospective

**작성 목적**: 실제 코드베이스 분석 기반의 회고형 WBS + 완성도 퍼센트 산출

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 기간 | 2025-05-23 ~ 2026-02-14 (9개월) |
| 커밋 | 5,698개 |
| 코드량 | ~166,000 Lines (Frontend 47K+ / AI Engine 31K / Config & Tests) |
| 목적 | 포트폴리오 & 바이브 코딩 학습 결과물 |

---

## 2. WBS (회고형 - 실제 진행 기록)

### Phase 1: Foundation (2025-05 ~ 2025-08)
| 작업 | 상태 | 비고 |
|------|:----:|------|
| Next.js + React 프로젝트 초기 구축 | 100% | ESLint, TypeScript 설정 |
| 대시보드 UI 컴포넌트 설계 | 100% | ServerCard, Summary, Header |
| Mock 데이터 시스템 구축 | 100% | 15대 Korean DC 서버 |
| Supabase 연동 (Auth + DB) | 100% | OAuth, pgvector |

### Phase 2: Core Features (2025-08 ~ 2025-11)
| 작업 | 상태 | 비고 |
|------|:----:|------|
| AI 채팅 시스템 (v1) | 100% | 이후 v4로 리팩토링 |
| 서버 메트릭 파이프라인 | 100% | hourly-data SSOT (Prometheus + Loki 로그) |
| E2E 테스트 (Playwright) | 100% | smoke, guest, a11y |
| GitHub OAuth 인증 | 100% | Supabase 통합 |

### Phase 3: AI Engine (2025-11 ~ 2026-01)
| 작업 | 상태 | 비고 |
|------|:----:|------|
| Cloud Run AI Engine 구축 | 100% | Hono + Multi-Agent |
| LangGraph → Vercel AI SDK v6 마이그레이션 | 100% | 2025-12-28 완료 |
| 7-Agent 실행 체계 + Orchestrator 코디네이터 | 100% | AgentFactory + Orchestrator 분리 |
| RAG/Knowledge Graph (pgvector + LlamaIndex) | 85% | 임베딩 품질 개선 여지 |
| Prompt Injection 방어 | 100% | OWASP LLM Top 10 기반 |
| Circuit Breaker + 3-way Fallback | 100% | Cerebras → Groq → Mistral |

### Phase 4: 품질 & 최적화 (2026-01 ~ 2026-02)
| 작업 | 상태 | 비고 |
|------|:----:|------|
| Dead Code 정리 (~7,300줄 제거) | 100% | 4차 정리 완료 (770→747파일) |
| 대형 파일 리팩토링 (800줄+ → 0개) | 100% | 분할 완료 |
| any 타입 제거 (17→0) | 100% | TypeScript strict |
| console.log → Pino Logger (92%) | 100% | 구조화 로깅 |
| AsyncLocalStorage Trace ID | 100% | W3C Trace Context |
| Free Tier Guard Rails | 100% | Cloud Run + Build |

### Phase 5: 문서 & 포트폴리오 (2026-02)
| 작업 | 상태 | 비고 |
|------|:----:|------|
| 문서 통합 (122→48개) | 100% | Diataxis 분류 |
| 아키텍처 문서 정확성 검증 | 100% | Mermaid + ASCII |
| docs/README 포트폴리오 관점 개편 | 100% | 결과물 + 개발환경 |
| WBS + 완성도 분석 (본 문서) | 100% | 실제 코드 기반 |

---

## 3. 도메인별 완성도 분석 (실제 코드 기반)

### 3.1 Frontend (94%)

| 영역 | 완성도 | 근거 |
|------|:------:|------|
| Dashboard 컴포넌트 (22파일) | 96% | transition/ 데드코드 삭제, 모든 컴포넌트 활성 |
| AI Sidebar (V4, 15파일) | 95% | `useAIChatCore` 공통화 + Streaming/Job Queue/명확화/RAG 출처 표시 |
| AI 전체페이지 (`/dashboard/ai-assistant`) | 93% | `AIWorkspace` 풀스크린 레이아웃 + 기능 페이지 통합, 라우팅 정합성 수정 |
| Landing Page | 90% | OAuth, 시스템 제어, 웜업, 애니메이션 |
| 상태관리 (Zustand 4개) | 100% | persist, devtools, useShallow 최적화, 미사용 selector 정리 |
| 미사용 컴포넌트 | 0개 | 4차 정리 검증 (SystemBootSequence, FloatingSystemControl, Sparkline, Modal 등 삭제) |

### 3.2 API Routes (91%)

| 라우트 | 구현도 | 인증 | 호출 빈도 |
|--------|:-----:|:---:|:---------:|
| `/api/ai/supervisor` | 95% | withAuth | 매우높음 |
| `/api/ai/supervisor/stream/v2` | 90% | withAuth | 매우높음 |
| `/api/ai/jobs` + `/:id` + `/stream` | 90% | withAuth | 높음 |
| `/api/ai/incident-report` | 90% | withAuth | 중간 |
| `/api/servers-unified` | 90% | withAuth | 매우높음 |
| `/api/servers/:id` | 85% | withAuth | 높음 |
| `/api/health` | 95% | Public | 높음 |
| `/api/system` | 90% | withAuth | 높음 |
| `/api/ai/feedback` | 95% | withAuth | 낮음 |
| `/api/metrics` | 90% | withAuth | 중간 |
| `/api/alerts/stream` | 85% | withAuth | 낮음 |
| 기타 (30개 route.ts 기준 구현) | 85%+ | withAuth/Public | 혼합 |

**해결 완료** (2026-02-14):
- ~~`/api/ai/feedback` 인증 없음~~ → withAuth 추가 완료
- ~~`/api/ai/feedback` 메모리 저장~~ → Supabase `ai_feedback` 테이블 영속 저장 완료
- ~~`/api/alerts/stream` 인증 없음~~ → withAuth 추가 완료
- ~~`/api/metrics` PromQL 하드코딩~~ → 레지스트리 기반 파서 (13개 메트릭 + 레이블 필터) 완료
- ~~스텁 API 7개~~ → 이전 세션에서 삭제 완료, 현재 0개
- ~~Vision Agent fallback 없음~~ → Orchestrator에 Analyst 폴백 이미 구현됨 확인
- ~~`/api/servers/:id` 시계열 metric key 불일치~~ → OTel 상수(`OTEL_METRIC.*`) 기반으로 수정 완료 (`system.*`)
- ~~`/api/servers/next` 인증 응답 public CDN 캐시~~ → `private, no-store`로 수정 완료

### 3.3 Cloud Run AI Engine (90%)

| 영역 | 완성도 | 근거 |
|------|:------:|------|
| 서버 엔트리 (Hono) | 97% | CORS, 인증(timing-safe), Rate Limit(SHA-256), Graceful Shutdown(30s timeout) |
| 7개 실행 에이전트 + Orchestrator | 92% | NLQ/Analyst/Reporter/Advisor/Vision + Evaluator/Optimizer + Orchestrator |
| 27개 도구 (Tools) | 98% | 전체 구현, validateTools() 시작 검증 |
| 보안 (Prompt Guard) | 95% | 15개 패턴 (EN+KO), OWASP 기반, timing-safe 비교, stateful regex 보호 |
| RAG/Knowledge | 85% | LlamaIndex + pgvector, Mistral 임베딩 |
| 테스트 | 65% | 5,613줄, 단위 우수, E2E 부족 |
| 배포 (Docker + Cloud Run) | 98% | Free Tier Guard Rails, 3-stage build |
| Langfuse 관찰성 | 90% | 10% 샘플링, Free Tier 보호 |

**해결 완료** (2026-02-14~15):
- ~~Vision Agent fallback 없음~~ → Gemini → OpenRouter(nvidia/nemotron-nano-12b-v2-vl:free) → Analyst Agent 3단 폴백 완료
- ~~OpenRouter 기본 모델 무효 endpoint~~ → 기본 모델/문서 갱신 + OpenRouter 권장 헤더(`HTTP-Referer`, `X-Title`) 및 provider 옵션(`allow_fallbacks`, `require_parameters`) 반영
- ~~OpenRouter 단일 모델 지정으로 fallback 라우팅 미활용~~ → `models` 체인 주입(`OPENROUTER_MODEL_VISION_FALLBACKS`) + 호환성 테스트 추가 완료
- ~~OpenRouter Free Tier tool-calling 불안정~~ → Vision+OpenRouter 조합 기본 tool-calling 비활성화(`OPENROUTER_VISION_TOOL_CALLING=false`)
- ~~OpenRouter 무료티어 실동작 미검증~~ → `/chat/completions` 실호출 스모크(HTTP 200, usage.cost=0) 검증 완료

**해결 완료** (2026-02-15, 보안 개선):
- ~~API Key 비교 문자열 단순 비교~~ → `timingSafeEqual` (timing attack 방어)
- ~~Rate Limiter API Key suffix 노출~~ → SHA-256 해시 기반 식별자로 교체
- ~~Dockerfile heap 384MB (512Mi 컨테이너 headroom 부족)~~ → 256MB로 축소
- ~~Graceful Shutdown 타임아웃 없음~~ → 30초 강제 종료 타임아웃 추가
- ~~Handoff events 배열 무한 증가~~ → O(1) 링 버퍼(50건) 교체
- ~~Prompt Injection stateful regex~~ → `lastIndex` 리셋 + low-risk 경고 분리

**남은 항목 1건**:
1. E2E 테스트 부족 (Cloud Run 단독 통합 테스트 없음)

#### 3.3-a 에이전트 수 산정 기준 (코드 기준)

- 기준 파일:
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/index.ts`
- 산정 규칙:
  1. `AGENT_CONFIGS`에 등록된 실행 단위를 "실행 에이전트"로 집계
  2. Orchestrator는 `AGENT_CONFIGS` 외부의 코디네이터이므로 별도 집계
  3. Verifier는 현재 "모델 헬퍼(getVerifierModel)"만 존재하며 실행 에이전트 집계에서 제외
- 집계 결과:
  - 실행 에이전트: 7개 (NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer)
  - 코디네이터 포함 AI 실행 컴포넌트: 8개 (7개 + Orchestrator)
  - Supervisor 가용 툴: 27개 (`Object.keys(allTools).length`)

### 3.4 Server Data (서버 데이터 파이프라인) (98%)

> 아키텍처: Vercel + Cloud Run 듀얼 배포에 동일 데이터 번들링 (DB 중앙 집중화 대신 통신 비용/지연 제거)

#### A. Prometheus 서버 메트릭 (100%)

| 항목 | 완성도 | 근거 |
|------|:------:|------|
| 15대 Korean DC 서버 | 100% | Seoul ICN 10 + Busan PUS DR 5 (web/app/db/cache/storage/lb) |
| 10개 node_exporter 메트릭 | 100% | cpu, memory, disk, network, load1/5, boot_time, procs, http_duration, up |
| 24시간 × 10분 간격 | 100% | 24파일, 6슬롯/시간, 144총슬롯, 21,600 메트릭 |
| Daily Rotation | 100% | KST 기준 오늘 날짜 자동 계산 (`getTimestampMs()`) |
| 장애 시나리오 5개 | 100% | h02(DB백업), h03(슬로우쿼리), h07(LB과부하), h12(Redis OOM), h21(CPU폭증) |
| 듀얼 포맷 파이프라인 | 100% | Prometheus(Vercel 번들) + OTel Standard(Cloud Run) |

#### B. Loki 로그 시스템 (100%)

| 항목 | 완성도 | 근거 |
|------|:------:|------|
| Loki 타입 정의 | 100% | LokiStreamLabels, LokiLogEntry, LokiStream, LokiPushPayload |
| 메트릭 기반 로그 생성기 | 100% | `generateServerLogs()` 4-pass (cpu>90→throttle, mem>85→OOM 등) |
| Loki Push API 변환 | 100% | `generateLokiLogs()`, `groupIntoStreams()`, `buildLokiPushPayload()` |
| Loki 라벨 6개 | 100% | job, hostname, level, environment, datacenter, server_type |
| hourly-data 로그 적재 | 100% | 2160/2160 target (online→info, warning→warn, critical→error+kernel) |
| UI 런타임 로그 표시 | 100% | `useGlobalLogs` 60초 갱신 + LogsTab syslog/alerts/streams 3탭 |

#### C. 데이터 파이프라인 (100%)

| 항목 | 완성도 | 근거 |
|------|:------:|------|
| 데이터 품질 스크립트 | 100% | `otel-fix.ts` (일괄 변환) + `otel-verify.ts` (16개 검증) |
| OTel SSOT | 100% | `src/data/otel-data/` (resource-catalog + timeseries + 24 hourly) |
| 듀얼 배포 번들링 | 100% | Vercel(src/data) + Cloud Run(cloud-run/data) 동일 스냅샷 |
| MetricsProvider SSOT | 100% | OTel 직접 소비, hourly-data 레거시 삭제 완료 |
| AI Engine 장애 감지 | 100% | `precomputed-state.ts` 3-path fallback 로딩 |

**해결 완료** (2026-02-15):
- ~~hourly-data `logs: []` 비어있음~~ → 메트릭 연동 로그 2160/2160 target 100% 적재 완료
- ~~`generateLogs()` 정상 서버 빈 배열~~ → 모든 서버에 info/warn/error 로그 생성
- ~~Cloud Run `precomputed-state` OTel 경로 불일치~~ → `otel-processed`/`otel-data` 다중 경로 지원 + runtime fallback 보강 완료
- ~~빈 슬롯 시 `getCurrentState()`/`getStateAtRelativeTime()` 런타임 예외~~ → fallback 슬롯 생성으로 무중단 응답 보장
- ~~`system.network.io` 단위 `By/s` + 값 35-65 (혼재)~~ → 단위 `1`, 값 0-1 ratio 통일 (otel-fix.ts)
- ~~Redis OOM 로그 kill 후 재시작 시퀀스 부재~~ → systemd restart 시퀀스 삽입
- ~~로그 심각도 INFO 97.7% (비현실적)~~ → INFO 81%/WARN 12%/ERROR 7% 재조정
- ~~Watchdog 메시지 슬롯당 16회 중복~~ → 슬롯당 2회 이내로 제한
- ~~S3 Gateway에 NFS 로그 혼입~~ → MinIO S3 로그로 교체
- ~~`otel-processed/` 레거시 디렉토리 잔존~~ → 삭제 (import 0건 확인)
- ~~`timeseries.json`에 `system.uptime`, `system.process.count` 누락~~ → 9개 메트릭 완비

### 3.5 Services & Library (90%)

| 영역 | 완성도 | 근거 |
|------|:------:|------|
| MetricsProvider (Singleton) | 100% | OTel Primary, network ×100 변환 수정 완료 |
| ServerMonitoringService | 100% | 11개 API 라우트에서 사용 |
| Circuit Breaker (분산) | 100% | InMemory + Redis, 3상태 전이 |
| Auth (전략 패턴) | 100% | Session/JWT/API Key, 캐시 |
| AI Cache (다층) | 100% | 메모리 + Redis, TTL 정책 |
| Config (SSOT) | 100% | 20파일, Zod 검증 |
| Scripts (데이터 동기화) | 100% | sync-hourly-data + otel-precompute (로그 적재 완료) |
| Utils/Lib 정리 | 100% | api-batcher, error-response, safeFormat, network-tracking, timeout-config, CentralizedDataManager 삭제 |
| 테스트 인프라 | 80% | 52파일, 10,859줄, 커버리지 ~11% |
| AI SDK 버전 정합성 | 100% | Root `ai@6.0.86`, `@ai-sdk/react@3.0.88`로 상향 및 스모크 검증 |

### 3.6 문서 (95%)

| 영역 | 완성도 | 근거 |
|------|:------:|------|
| 활성 문서 | 48개 (예산 55) | 100% 메타데이터 |
| 아키텍처 문서 | 6개 | Mermaid + ASCII 듀얼 |
| 바이브 코딩 문서 | 7개 | MCP, Skills, Agent Teams |
| README (포트폴리오 관점) | 완료 | 결과물 + 개발환경 |

---

## 4. 종합 완성도

| 도메인 | 가중치 | 완성도 | 가중 점수 |
|--------|:------:|:------:|:---------:|
| Frontend | 20% | 95% | 19.0 |
| API Routes | 15% | 91% | 13.7 |
| AI Engine | 20% | 93% | 18.6 |
| Server Data | 15% | 98% | 14.7 |
| Services/Lib | 20% | 92% | 18.4 |
| 문서/테스트 | 10% | 95% | 9.5 |
| **합계** | **100%** | | **94.2%** |

**결론: 실제 완성도 ~94%** (88% → 91%(P0 보안) → 93%(서버 데이터) → 94%(데드코드 4차) → 94.2%(OTel 데이터 품질+Cloud Run 보안))

---

## 5. 미완성 항목 분류

### 반드시 수정 (포트폴리오 품질에 영향)

| # | 항목 | 현재 | 개선안 | 영향 |
|---|------|------|--------|------|
| ~~1~~ | ~~`/api/ai/feedback` 메모리 저장~~ | ~~서버 재시작 시 손실~~ | ~~Supabase 저장~~ | **완료** (2026-02-14) |
| ~~2~~ | ~~`/api/ai/feedback` 인증 없음~~ | ~~Rate Limit만~~ | ~~withAuth 추가~~ | **완료** (2026-02-14) |
| ~~3~~ | ~~`/api/alerts/stream` 인증 없음~~ | ~~Public~~ | ~~withAuth 추가~~ | **완료** (2026-02-14) |

### 개선 권장 (품질 향상)

| # | 항목 | 현재 | 개선안 | 영향 |
|---|------|------|--------|------|
| ~~4~~ | ~~`/api/metrics` PromQL~~ | ~~switch-case~~ | ~~레지스트리 파서~~ | **완료** (2026-02-14) |
| ~~5~~ | ~~Vision Agent fallback~~ | ~~Gemini 전용~~ | ~~3단 폴백~~ | **완료** (Gemini→OpenRouter→Analyst) |
| ~~6~~ | ~~스텁 API 라우트 7개~~ | ~~미구현~~ | ~~삭제~~ | **완료** (이전 세션) |
| ~~7~~ | ~~hourly-data 로그 비어있음~~ | ~~`logs: []`~~ | ~~메트릭 연동 로그 적재~~ | **완료** (2026-02-15) |
| 8 | 테스트 커버리지 ~11% | 206개 테스트 | 주요 경로 추가 | 신뢰성 |

### 현상 유지 가능 (포트폴리오로 충분)

| # | 항목 | 근거 |
|---|------|------|
| 8 | RAG 임베딩 품질 | Mistral small 충분, 비용 0 |
| 9 | AI Engine E2E 테스트 | Production QA로 대체 |
| 10 | 레거시 API 혼재 | servers-unified가 정상 동작 |

---

## 6. 남은 작업 예상 (1~3 → 필수, 4~7 → 권장)

| 작업 | 예상 규모 | 우선순위 |
|------|----------|:--------:|
| ~~feedback API 인증 추가~~ | ~~완료~~ | ~~P0~~ |
| ~~alerts/stream 인증 추가~~ | ~~완료~~ | ~~P0~~ |
| ~~스텁 API 정리 (삭제)~~ | ~~완료~~ | ~~P1~~ |
| ~~feedback API DB 저장~~ | ~~완료~~ | ~~P2~~ |
| ~~metrics PromQL 개선~~ | ~~완료~~ | ~~P2~~ |
| ~~Vision Agent fallback~~ | ~~완료~~ | ~~P2~~ |
| ~~hourly-data 로그 적재~~ | ~~완료~~ | ~~P1~~ |
| 테스트 커버리지 확대 | ~500줄 | P3 |
| Resume Stream v2 회귀 테스트 강화 | ~200줄 | P2 |

---

## 7. WBS 기반 작업 완성 체크리스트 (AI Assistant / Cloud Run)

요청 반영: 별도 리포트 분리 대신 `wbs.md` 내부 SSOT로 통합.

### 7.1 AI Assistant 체크리스트

| 항목 | 상태 | 근거 |
|------|:----:|------|
| Supervisor API 인증/레이트리밋 | 완료 | `src/app/api/ai/supervisor/route.ts:99`, `src/app/api/ai/supervisor/route.ts:101` |
| Supervisor Zod 요청 검증 | 완료 | `src/app/api/ai/supervisor/route.ts:122` |
| Prompt Injection 탐지/차단 | 완료 | `src/app/api/ai/supervisor/route.ts:166`, `src/app/api/ai/supervisor/route.ts:172` |
| Stream v2(GET/POST) 인증 | 완료 | `src/app/api/ai/supervisor/stream/v2/route.ts:183`, `src/app/api/ai/supervisor/stream/v2/route.ts:194` |
| Stream v2 보안 차단 | 완료 | `src/app/api/ai/supervisor/stream/v2/route.ts:236`, `src/app/api/ai/supervisor/stream/v2/route.ts:239` |
| Cloud Run 스트림 프록시/타임아웃 | 완료 | `src/app/api/ai/supervisor/stream/v2/route.ts:277`, `src/app/api/ai/supervisor/stream/v2/route.ts:283` |
| Trace ID 관찰성 연계 | 완료 | `src/app/api/ai/supervisor/route.ts:102`, `src/app/api/ai/supervisor/route.ts:114` |
| 보안/스키마 단위 테스트 | 완료 | `src/app/api/ai/supervisor/security.test.ts`, `src/app/api/ai/supervisor/schemas.test.ts` |
| Cloud Run 실연동 E2E 회귀 세트 | 미완료 | 3.3/5장 잔여 이슈(통합/E2E 부족) |

분석:
- 필수 경로(인증/보안/스트리밍/관찰성)는 구현 완료.
- 현재 갭은 기능 구현보다 회귀 자동화 범위(E2E) 부족.

### 7.2 Google Cloud Run 체크리스트

| 항목 | 상태 | 근거 |
|------|:----:|------|
| Hono API Key 보안(실패시 차단) | 완료 | `cloud-run/ai-engine/src/server.ts:69`, `cloud-run/ai-engine/src/server.ts:73` |
| API 전역 레이트리밋 | 완료 | `cloud-run/ai-engine/src/server.ts:85`, `cloud-run/ai-engine/src/middleware/rate-limiter.ts:200` |
| `/health` + `/warmup` 제공 | 완료 | `cloud-run/ai-engine/src/server.ts:107`, `cloud-run/ai-engine/src/server.ts:121` |
| Supervisor 헬스 엔드포인트 | 완료 | `cloud-run/ai-engine/src/routes/supervisor.ts:413` |
| Circuit Breaker 적용 | 완료 | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts:236`, `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts:238` |
| Retry/Fallback 전략 | 완료 | `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts:211`, `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts:236` |
| Vision Gemini→OpenRouter 폴백 | 완료 | `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts:489`, `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts:520` |
| precomputed-state 데이터 경로/빈 슬롯 방어 | 완료 | `cloud-run/ai-engine/src/data/precomputed-state.ts:197`, `cloud-run/ai-engine/src/data/precomputed-state.ts:588`, `cloud-run/ai-engine/src/data/precomputed-state.ts:642` |
| Free Tier Guardrails 강제 | 완료 | `cloud-run/ai-engine/deploy.sh:177`, `cloud-run/ai-engine/deploy.sh:194`, `cloud-run/ai-engine/deploy.sh:208` |
| Cloud Build free-tier 파라미터 고정 | 완료 | `cloud-run/ai-engine/cloudbuild.yaml:104`, `cloud-run/ai-engine/cloudbuild.yaml:113`, `cloud-run/ai-engine/cloudbuild.yaml:117` |
| Docker 헬스체크/그레이스풀 종료 | 완료 | `cloud-run/ai-engine/Dockerfile:144`, `cloud-run/ai-engine/Dockerfile:152` |
| Cloud Run 단독 통합/E2E 파이프라인 | 미완료 | 3.3장 잔여 이슈(Cloud Run 단독 통합 테스트 없음) |
| 저비용 필수 스모크 스크립트(배포 검증) | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs`, `package.json` |
| 토큰 사용 제어(기본 0회, 옵션 1회) | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |

분석:
- 운영 안정화(보안/폴백/배포 가드레일)는 높은 수준으로 완료.
- 남은 리스크는 장애/실연동 회귀를 자동으로 보장하는 테스트 체계 부족.

### 7.3 우선순위 액션

1. P1: Cloud Run 단독 통합 테스트 신설  
   대상: `/health`, `/api/ai/supervisor`, `/api/ai/supervisor/stream/v2`
2. P2: AI Assistant 회귀 E2E 고정 시나리오 추가  
   대상: 인증, 보안 차단, 스트리밍 재개, 폴백 응답
3. P2: AI Sidebar/AI 전체페이지 사용자 흐름 E2E 추가  
   대상: 열기/닫기, 전체화면 전환, 세션 재개, RAG 출처 렌더링
4. P2: Redis+Supabase RAG 통합 스모크 자동화  
   대상: `searchKnowledgeBase` 결과 → `ragSources` → 프론트 배지 노출

### 7.4 AI Sidebar 완성도 체크리스트 (코드 점검)

| 항목 | 상태 | 근거 |
|------|:----:|------|
| 대시보드 동적 로드 + 전역 오픈 상태 연결 | 완료 | `src/app/dashboard/DashboardClient.tsx:46`, `src/app/dashboard/DashboardClient.tsx:177` |
| 권한 기반 렌더링 가드 | 완료 | `src/components/ai-sidebar/AISidebarV4.tsx:369` |
| 공통 채팅 코어(`useAIChatCore`) 사용 | 완료 | `src/components/ai-sidebar/AISidebarV4.tsx:313`, `src/hooks/ai/useAIChatCore.ts:106` |
| Streaming + Job Queue 하이브리드 동작 | 완료 | `src/hooks/ai/useAIChatCore.ts:168`, `src/app/api/ai/jobs/route.ts:1` |
| 스트림 재개(Resumable) 연동 | 완료 | `src/app/api/ai/supervisor/stream/v2/route.ts:87`, `src/app/api/ai/supervisor/stream/v2/upstash-resumable.ts:40` |
| UI 상호작용(리사이즈/ESC/스와이프) | 완료 | `src/components/ai-sidebar/AISidebarV4.tsx:250`, `src/components/ai-sidebar/AISidebarV4.tsx:325`, `src/components/ai-sidebar/AISidebarV4.tsx:347` |
| 웹 검색 토글/세션 상태 영속화 | 완료 | `src/stores/useAISidebarStore.ts:306`, `src/stores/useAISidebarStore.ts:315` |
| RAG 출처/분석근거 배지 노출 | 완료 | `src/components/ai-sidebar/AISidebarV4.tsx:175`, `src/hooks/ai/utils/message-helpers.ts:140`, `src/hooks/ai/utils/message-helpers.test.ts` |
| Sidebar 전용 컴포넌트 회귀 테스트 | 부분완료 | `AIWorkspace` 테스트는 존재하나 `AISidebarV4` 직접 테스트 부재 (`src/components/ai/AIWorkspace.test.tsx:136`) |

점검 결론:
- 구현 완성도는 높음(약 95%).
- 남은 갭은 `AISidebarV4` 단위/상호작용 회귀 자동화.

### 7.5 AI 전체페이지 완성도 체크리스트 (코드 점검)

| 항목 | 상태 | 근거 |
|------|:----:|------|
| 전용 라우트 제공 (`/dashboard/ai-assistant`) | 완료 | `src/app/dashboard/ai-assistant/page.tsx:5` |
| 풀스크린 워크스페이스 레이아웃 | 완료 | `src/components/ai/AIWorkspace.tsx:207` |
| 공통 채팅 코어 + 기능 페이지 통합 | 완료 | `src/components/ai/AIWorkspace.tsx:90`, `src/components/ai/AIWorkspace.tsx:188` |
| Auto Report / Intelligent Monitoring 페이지 로딩 | 완료 | `src/components/ai/AIContentArea.tsx:58`, `src/components/ai/AIContentArea.tsx:67` |
| 사이드바→전체화면 전환 경로 정합성 | 완료 | `src/components/ai/AIAssistantIconPanel.tsx:189`, `src/components/ai/AIWorkspace.tsx:142` |
| Hydration 안전 처리 | 완료 | `src/components/ai/AIWorkspace.tsx:66`, `src/components/ai/AIWorkspace.tsx:124` |
| 단위 테스트(기본 렌더/네비게이션/경로 회귀) | 완료 | `src/components/ai/AIWorkspace.test.tsx:136` |
| 라우트 레벨 E2E (`/dashboard/ai-assistant`) | 미완료 | Playwright 고정 시나리오 부재 (WBS 잔여) |

점검 결론:
- 기능 구현은 안정권(약 93%).
- `/dashboard/ai-assistant` 기준 브라우저 E2E가 다음 우선 보강 항목.

### 7.6 Redis + Supabase RAG 체크리스트 (코드 점검)

| 항목 | 상태 | 근거 |
|------|:----:|------|
| 저장소 경계 분리(Redis=일시 상태, Supabase=영속/RAG) | 완료 | `src/app/api/ai/jobs/route.ts:1`, `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts:343` |
| Redis Job Queue 저장/조회(MGET 최적화 포함) | 완료 | `src/app/api/ai/jobs/route.ts:107`, `src/app/api/ai/jobs/route.ts:205` |
| Redis 기반 Stream v2 세션/청크 재개 | 완료 | `src/app/api/ai/supervisor/stream/v2/stream-state.ts:22`, `src/app/api/ai/supervisor/stream/v2/upstash-resumable.ts:174` |
| Redis 장애 시 방어(가용성 우선/폴백 응답) | 완료 | `src/lib/redis/client.ts:50`, `src/app/api/ai/jobs/route.ts:66` |
| Supabase 피드백 영속 저장 | 완료 | `src/app/api/ai/feedback/route.ts:43`, `src/app/api/ai/feedback/route.ts:148` |
| Supabase 장애 보고서 영속 저장/조회 | 완료 | `src/app/api/ai/incident-report/route.ts:166`, `src/app/api/ai/incident-report/route.ts:309` |
| Cloud Run GraphRAG 검색 + Supabase 미가용 폴백 | 완료 | `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts:345`, `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts:527` |
| 승인 기반 Incident→RAG 자동 주입/주기 백필 | 완료 | `cloud-run/ai-engine/src/services/approval/approval-store.ts:325`, `cloud-run/ai-engine/src/server.ts:405` |
| `ragSources` 백엔드→프론트 전달 | 완료 | `cloud-run/ai-engine/src/routes/supervisor.ts:201`, `src/hooks/ai/utils/message-helpers.ts:141` |
| Redis+Supabase 동시 장애/지연 통합 회귀 테스트 | 부분완료 | 단위 테스트 중심, 실연동 통합 자동화 미흡 (`3.3 테스트 65%`) |

점검 결론:
- 아키텍처 경계와 주요 경로는 구현 완료(약 89%).
- 잔여 리스크는 “실서비스 의존 통합 회귀” 자동화 부족.

### 7.7 클라우드 배포 최소 필수 테스트 정책 (비용 최적화)

목표:
- 배포 환경에서 장애를 빨리 탐지하되, 무료/저비용 범위를 벗어나지 않도록 검증 호출 수를 최소화.

| 항목 | 상태 | 근거 |
|------|:----:|------|
| 기본 검증은 LLM 비호출 3개 엔드포인트만 수행 | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| `/health` 필수 | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| `/warmup` 필수 | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| `/api/ai/supervisor/health` 인증 검증 | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| 인증키 미제공 시 비용 높은 테스트 자동 스킵 | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| 실제 추론 테스트는 기본 비활성화(옵션 1회) | 완료 | `scripts/test/cloud-deploy-essential-smoke.mjs` |
| 실행 스크립트 표준화(`npm run test:cloud:essential*`) | 완료 | `package.json` |
| 운영 가이드 반영 | 완료 | `cloud-run/ai-engine/README.md` |

권장 운영 순서:
1. `npm run test:cloud:essential -- --url=<CLOUD_RUN_URL>`
2. (릴리즈 직전 1회만) `npm run test:cloud:essential:llm-once -- --url=<CLOUD_RUN_URL>`

실행 검증 (2026-02-15):
- `strict`(인증 필수, LLM 0회): 3/3 PASS
- `llm-once`(추론 1회): 4/4 PASS
- 검증 대상: `https://ai-engine-490817238363.asia-northeast1.run.app`

### 7.8 WSL 문서 관리 영역 체크리스트

목표:
- WSL 환경에서 문서 품질 점검을 표준화하고, 점검 산출물을 고정 경로에 저장해 재현성을 확보.

| 항목 | 상태 | 근거 |
|------|:----:|------|
| WSL 전용 문서 점검 스크립트 제공 | 완료 | `scripts/wsl/docs-management-check.sh` |
| WSL 환경 감지(비-WSL 실행 차단) | 완료 | `scripts/wsl/docs-management-check.sh` |
| 점검 산출물 전용 경로 생성 | 완료 | `logs/docs-reports/wsl/` |
| 기본 점검 명령 표준화(`docs:check:wsl`) | 완료 | `package.json` |
| strict 점검 명령 표준화(`docs:check:wsl:strict`) | 완료 | `package.json` |
| 문서 관리 가이드 반영 | 완료 | `docs/development/documentation-management.md` |
| 운영 모델 결정(단일 허브+영역 분산) | 완료 | `docs/development/documentation-management.md` |
| WSL 신규 문서 생성 억제(병합 우선) 규칙 | 완료 | `docs/development/documentation-management.md` |

권장 실행:
1. `npm run docs:check:wsl`
2. `npm run docs:check:wsl:strict` (문서 변경 PR 전)

---

_분석 기준: 4개 병렬 탐색 에이전트로 src/, cloud-run/, scripts/ 전체 코드 분석_
_최종 갱신: 2026-02-15 (AI Sidebar/AI 전체페이지/Redis+Supabase RAG + Cloud 저비용 필수 테스트 정책 + WSL 문서 관리 체크리스트/하이브리드 운영 모델 반영)_
