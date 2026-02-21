# OpenManager AI v8.1.0 - Software Requirements Specification

> Owner: project-lead
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-18
> Tags: requirements,srs,functional,non-functional

**기반**: IEEE 830 / ISO/IEC/IEEE 29148 경량 버전
**범위**: 포트폴리오 & 바이브 코딩 학습 결과물 (상용 SaaS 아님)

---

## 1. 프로젝트 제약조건

| 제약 | 내용 |
|------|------|
| 목적 | 개인 포트폴리오 + 바이브 코딩 학습 |
| 운영 비용 | ₩0 (배포된 실 서비스 기준. 단, 개발/설계 시 활용하는 AI 코딩 도구 비용은 별도) |
| 개발 인력 | 1인 |
| 데이터 | 시뮬레이션 (Korean DC 15대 가상 서버) |
| 핵심 가치 | "대화로 서버를 모니터링한다" |

---

## 2. 기능 요구사항 (Functional Requirements)

### FR-001: 대시보드 서버 모니터링

| 항목 | 내용 |
|------|------|
| 설명 | 15대 서버의 CPU, Memory, Disk, Network 등 10개 메트릭을 실시간 대시보드에 표시 |
| 수용 기준 | 15대 ServerCard 정상 렌더링, 1초 폴링 갱신, 장애 서버 시각적 구분 |
| 구현 | `src/components/dashboard/`, `src/services/metrics/MetricsProvider.ts` |

### FR-002: AI 자연어 분석 (NLQ)

| 항목 | 내용 |
|------|------|
| 설명 | 사용자 자연어 질문 → 메트릭 조회 → AI 분석 응답 |
| 수용 기준 | 한국어/영어 질문 처리, 서버명 인식, 메트릭 기반 응답 생성 |
| 구현 | `src/hooks/ai/useAIChatCore.ts`, `cloud-run/ai-engine/src/agents/` |

### FR-003: 장애 근본 원인 분석 (RCA)

| 항목 | 내용 |
|------|------|
| 설명 | 장애 감지 시 근본 원인 분석 + Timeline 제공 |
| 수용 기준 | 5개 장애 시나리오에 대해 원인 식별, 타임라인 생성, 복구 제안 |
| 구현 | `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools/` |

### FR-004: RAG 기반 지식 검색

| 항목 | 내용 |
|------|------|
| 설명 | 과거 장애 보고서 + 기술 문서를 RAG로 검색하여 AI 응답에 활용 |
| 수용 기준 | pgvector 임베딩 검색, ragSources 배지 프론트 노출, 승인 기반 자동 주입 |
| 구현 | `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts` |

### FR-005: 인증/인가

| 항목 | 내용 |
|------|------|
| 설명 | GitHub OAuth 로그인 + Guest 모드 데모 접근 |
| 수용 기준 | OAuth 로그인→대시보드→로그아웃 정상, Guest 모드 제한적 접근 허용 |
| 구현 | `src/lib/auth/`, `src/app/api/auth/` |

### FR-006: 스트리밍 응답

| 항목 | 내용 |
|------|------|
| 설명 | AI 응답을 SSE 스트리밍으로 점진적 렌더링 + 연결 끊김 시 재개 |
| 수용 기준 | 토큰 단위 스트리밍, Resume v2 재개 정상, 30초 이상 응답 지원 |
| 구현 | `src/app/api/ai/supervisor/stream/v2/`, `src/hooks/ai/useAIChatCore.ts` |

### FR-007: 이상치 탐지 + 트렌드 예측

| 항목 | 내용 |
|------|------|
| 설명 | 메트릭 이상치 자동 감지, 트렌드 기반 예측 경고 |
| 수용 기준 | threshold 기반 상태 판정 (normal/warning/critical), `for` 지속시간 조건 |
| 구현 | `src/config/rules/system-rules.json`, `src/config/rules/loader.ts` |

### FR-008: 장애 보고서 생성/평가

| 항목 | 내용 |
|------|------|
| 설명 | AI 기반 장애 보고서 자동 생성 + 품질 평가 |
| 수용 기준 | Supabase 영속 저장, Evaluator+Optimizer 에이전트 평가 |
| 구현 | `src/app/api/ai/incident-report/`, `cloud-run/ai-engine/src/agents/` |

### FR-009: 웹 검색 통합

| 항목 | 내용 |
|------|------|
| 설명 | AI 응답 시 실시간 웹 검색 정보 통합 (토글 가능) |
| 수용 기준 | 웹 검색 토글 ON/OFF, 세션 상태 영속화, 검색 결과 응답에 반영 |
| 구현 | `src/stores/useAISidebarStore.ts`, `cloud-run/ai-engine/src/tools-ai-sdk/` |

### FR-010: 모바일 반응형 대시보드

| 항목 | 내용 |
|------|------|
| 설명 | 데스크탑/태블릿/모바일에서 깨짐 없는 대시보드 UI |
| 수용 기준 | Compact Variant 패턴, Progressive Disclosure, 44px 터치 타겟 |
| 구현 | `src/components/dashboard/ImprovedServerCard.tsx` |

---

## 3. 비기능 요구사항 (Non-Functional Requirements)

### NFR-001: 성능

| 항목 | 기준 |
|------|------|
| AI 응답 시간 | P95 < 3초 (첫 토큰), P99 < 10초 (전체) |
| 대시보드 렌더링 | 15대 ServerCard < 1초 |
| 메트릭 폴링 | 1초 간격 갱신 |

### NFR-002: 보안

| 항목 | 기준 |
|------|------|
| 웹 보안 | OWASP Top 10 대응 |
| AI 보안 | OWASP LLM Top 10 대응 (Prompt Injection 15패턴 방어) |
| API 인증 | withAuth + timing-safe 비교 + SHA-256 해싱 |
| 캐시 헤더 | 인증 API = `private, no-store` |

### NFR-003: 비용

| 항목 | 기준 |
|------|------|
| 운영 비용 | ₩0 (프로덕션 호스팅 한정 Free Tier Guard Rails 강제) |
| Cloud Build | e2-medium만 허용 (120분/일) |
| Cloud Run | 1 vCPU, 512Mi (180K vCPU-sec/월) |
| Vercel Build | Standard 머신만 ($0.014/min) |

### NFR-004: 가용성

| 항목 | 기준 |
|------|------|
| Provider Fallback | Cerebras → Groq → Mistral 3-way |
| Vision Fallback | Gemini → OpenRouter → Analyst 3단 |
| Circuit Breaker | InMemory + Redis, 3상태 전이 |
| Graceful Shutdown | SIGTERM → 30초 대기 → 강제 종료 |

### NFR-005: 접근성

| 항목 | 기준 |
|------|------|
| ARIA | role, aria-label, aria-modal 적용 |
| 키보드 | tabIndex, onKeyDown, focus-visible:ring |
| 포인터 | 전역 cursor:pointer (button, a[href], select) |
| 터치 타겟 | min 44px (min-h-11, min-w-11) |

### NFR-006: 코드 품질

| 항목 | 기준 |
|------|------|
| any 타입 | 0개 (TypeScript strict) |
| tsc --noEmit | 0 에러 |
| Biome lint | 0 에러 |
| 파일 길이 | 500줄 경고, 800줄+ 분할 필수 |
| 미사용 코드 | 0개 (4차 데드코드 정리 완료) |

### NFR-007: 관찰성

| 항목 | 기준 |
|------|------|
| 로깅 | Pino Logger 92%+ (구조화 로깅) |
| 트레이싱 | AsyncLocalStorage Trace ID (W3C Trace Context) |
| AI 관찰성 | Langfuse 10% 샘플링 (Free Tier 자동 보호) |

---

## 4. 추적 매트릭스

| 요구사항 | 핵심 구현 파일 |
|----------|--------------|
| FR-001 | `src/components/dashboard/`, `src/services/metrics/MetricsProvider.ts` |
| FR-002 | `src/hooks/ai/useAIChatCore.ts`, `cloud-run/ai-engine/src/agents/` |
| FR-003 | `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools/` |
| FR-004 | `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts` |
| FR-005 | `src/lib/auth/`, `src/app/api/auth/` |
| FR-006 | `src/app/api/ai/supervisor/stream/v2/` |
| FR-007 | `src/config/rules/system-rules.json`, `src/config/rules/loader.ts` |
| FR-008 | `src/app/api/ai/incident-report/`, `cloud-run/ai-engine/src/agents/` |
| FR-009 | `src/stores/useAISidebarStore.ts` |
| FR-010 | `src/components/dashboard/ImprovedServerCard.tsx` |
| NFR-001 | `cloud-run/ai-engine/src/services/resilience/` |
| NFR-002 | `cloud-run/ai-engine/src/middleware/`, `src/lib/auth/` |
| NFR-003 | `cloud-run/ai-engine/deploy.sh`, `.claude/rules/deployment.md` |
| NFR-004 | `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts` |
| NFR-005 | `src/components/dashboard/`, `src/app/globals.css` |
| NFR-006 | `biome.json`, `tsconfig.json` |
| NFR-007 | `src/lib/logger/`, `cloud-run/ai-engine/src/services/langfuse/` |

---

_Last Updated: 2026-02-18_
