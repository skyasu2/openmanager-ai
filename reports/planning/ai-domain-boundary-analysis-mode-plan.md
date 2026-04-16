> Owner: project
> Status: Active
> Doc type: Plan
> Last reviewed: 2026-04-16
> Tags: ai-assistant,domain-boundary,analysis-mode,web-search,general-queries

# AI Domain Boundary & Analysis Mode Plan

- 상태: **Active** — Phase 1 완료, Phase 2(분석 강도 모드) 구현 완료, Phase 3 QA/배포 대기
- 작성일: 2026-04-16
- TODO.md 연결: Active Tasks > AI Domain Boundary Phase 2 (분석 강도 모드)
- 목표: OpenManager AI를 `서버 운영/모니터링에 특화된 AI 어시스턴트`로 유지하되, 일반 질문도 `best-effort`로 다루는 현실적인 제품 정책과 UX를 정립한다.

## 1. 배경

- 현재 시스템 프롬프트와 도구 구성을 보면 OpenManager AI의 정체성은 이미 `서버 모니터링 AI 어시스턴트`에 가깝다.
  - [supervisor-routing.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts:31)
- 반면 UI에는 `Web 검색` 토글이 열려 있고, `searchWeb` 도구 설명은 일반 질문에도 활용 가능하다고 적혀 있다.
  - [ChatInputArea.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/ChatInputArea.tsx:252)
  - [web-search.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/web-search.ts:83)
- 이 상태는 기술적으로는 동작할 수 있지만, 제품 관점에서는 다음 문제가 있다.
  - 도메인 밖 질문(`날씨`, `운세`, 일반 잡학`)에 대해 `답하는지 / 얼마나 자신 있게 답하는지 / 언제 웹 검색을 쓰는지` 정책이 불명확하다.
  - `thinking` 표시 UI는 있지만, 분석 강도를 사용자가 명시적으로 선택할 수 없다.
  - `searchWeb`의 역할이 `최신 정보 보강`인지 `범용 웹 검색`인지 문서/UX에서 일관되지 않다.

## 2. 현재 구현 요약

### 2.1 질문 분류 및 실행 경로

- 프론트는 로컬 규칙 기반으로 쿼리를 분류하고 복잡도를 계산한다.
  - [query-classifier.ts](/mnt/d/dev/openmanager-ai/src/lib/ai/query-classifier.ts:1)
  - [query-complexity.ts](/mnt/d/dev/openmanager-ai/src/lib/ai/utils/query-complexity.ts:1)
- 프론트는 복잡도 기반으로 `streaming` vs `job-queue`를 고른다.
  - [useQueryExecution.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/core/useQueryExecution.ts:1)
- 백엔드는 별도로 `single-agent` vs `multi-agent`를 선택한다.
  - [supervisor-mode.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts:1)

### 2.2 도메인 밖 질문의 현재 동작

- `날씨`, `운세` 같은 질문은 보통 `general` 범주로 분류되어 `single-agent` 경로로 간다.
- 기본적으로 범용 질문 전용 정책/거절 경로는 없다.
- `Web 검색` 토글이 켜져 있어도, 강제 `searchWeb`는 `최신`, `CVE`, `공식 문서`, 연도 키워드 등이 있을 때만 활성화된다.
  - [supervisor-routing.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts:298)
- 결과적으로 오프도메인 질문은 `best-effort 응답`을 기대하게 만들지만, 실제 라우팅/설명 정책은 아직 정리돼 있지 않다.

### 2.3 분석 강도 UX

- 현재 있는 것:
  - `submitted / streaming / ready / error` 상태 머신
  - `ThinkingProcessVisualizer`
  - `AnalysisBasisBadge`
- 현재 없는 것:
  - `오토 / Thinking` 같은 명시적 응답 모드 토글
  - reasoning budget 또는 multi-agent 강제 여부를 사용자에게 보여주는 모드 UI

## 3. 공식 베스트 프랙티스 기준

### A. Google PAIR / Microsoft Transparency

- 사용자는 시스템이 무엇을 잘하고, 무엇을 하지 않는지 이해할 수 있어야 한다.
- intended use와 limitations가 UI/동작 정책에 반영되어야 한다.
- 정리:
  - OpenManager는 `운영 특화 AI`라는 intended use를 분명히 드러내야 한다.
  - 일반 질문도 받을 수는 있지만, `도메인 외 답변은 정확도/최신성이 제한될 수 있음`을 명시하는 편이 신뢰 측면에서 낫다.
- 참고:
  - https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/
  - https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note

### B. Anthropic / OpenAI Agent 설계

- 복잡한 에이전트 구조와 과도한 도구 수는 비용/지연/불확실성을 키운다.
- 단순한 도구 세트와 선명한 역할 정의가 더 안정적으로 동작한다.
- 정리:
  - 범용 질문을 받더라도 `최소 도구 경로(single-agent + finalAnswer / 필요시 searchWeb)`로 유지하는 편이 비용과 품질 모두 유리하다.
  - 분석 강도 제어는 `범용 추론 슬라이더`가 아니라 `도메인 내부 분석 강도 모드`로 설계하는 것이 적절하다.
- 참고:
  - https://www.anthropic.com/research/building-effective-agents
  - https://openai.com/index/inside-our-in-house-data-agent/

### C. Vercel AI SDK

- 범용 tool-calling 에이전트 자체는 충분히 구현 가능하다.
- 하지만 OpenManager는 범용 assistant보다 운영 제품에 가깝다.
- 정리:
  - 날씨/잡학 답변이 가능한지와, 제품이 그 방향으로 가야 하는지는 별개다.
- 참고:
  - https://vercel.com/guides/build-ai-agent-weather-api
  - https://vercel.com/docs/ai-sdk

## 4. 권장 정책

### 4.1 지원 범위

| 범주 | 예시 | 권장 동작 |
|------|------|-----------|
| 지원 | 장애 원인, 서버 상태, 리포트, 조치안, 로그, topology, 운영 지식 | 정상 처리 |
| 확장 지원 | 최신 CVE, 기술 문서, 보안 공지, 운영 관련 외부 정보 | `searchWeb` 기반 처리, 출처 인용 |
| 일반 질문 | 날씨, 일반 상식, 가벼운 생산성 질문 | `best-effort` 응답 + 도메인 특화 AI임을 짧게 고지 |
| 오락/주관형 | 운세, 가벼운 추천, 캐주얼 질문 | 짧은 참고용 응답 + 확신형 표현 금지 |

### 4.2 오프도메인 응답 원칙

- 완전 차단 대신 `best-effort`를 기본값으로 둔다.
- 다만 다음 원칙을 지킨다.
  - 오프도메인 질문에는 멀티에이전트/RAG/모니터링 도구를 붙이지 않는다.
  - 최신성 의존 질문은 `searchWeb`가 있을 때만 강화한다.
  - 응답 첫머리 또는 상단에 짧은 disclaimer를 둔다.
  - 예: `참고: 저는 서버 모니터링 중심 AI라 일반 정보 답변은 정확도와 최신성이 제한될 수 있습니다.`

### 4.3 분석 강도

| 모드 | 의도 | 권장 라우팅 |
|------|------|-------------|
| 오토 | 현재 기본 운영 질문 | 현행 자동 라우팅 유지 |
| Thinking | RCA/리포트/비교 분석/교차 검증 | 인프라 문맥에서 `multi-agent` 우선, Job Queue 더 적극 허용 |

## 5. 구현 전략

### Phase 1 — 도메인 정책 명시 (우선)

1. [x] 오프도메인 질문 감지 규칙 추가 (2026-04-16)
   - `query-classifier.ts`: `off-domain` intent + `isOffDomain` 플래그 추가
   - 날씨·운세·맛집·주식 추천 등 생활형 패턴 감지 정규식 적용
2. [x] 오프도메인 응답 UX (2026-04-16)
   - `useQueryExecution.ts`: off-domain 감지 시 `warning` 상태에 disclaimer 주입
   - 문구: `"참고: 저는 서버 운영·모니터링 중심 AI입니다. 일반 정보 답변은 정확도와 최신성이 제한될 수 있습니다."`
3. [x] `Web 검색` 라벨/설명 정리 (2026-04-16 이전 완료)
   - `ChatInputArea.tsx` 보조 카피 이미 `최신 정보 보강`으로 정리됨
4. [x] 지원 범위 안내 문구 추가 (2026-04-16)
   - `ChatInputArea.tsx` placeholder: `"서버 운영 질문을 입력하세요 (일반 질문도 best-effort 지원)"`
5. [x] 첨부 기능 맥락 보강 (2026-04-16)
   - `ChatInputArea.tsx` 첨부 placeholder: `"이미지/파일 분석 (시각·문서 분석) — 질문을 입력하세요"`

### Phase 2 — 분석 강도 모드 추가

1. [x] UI에 `오토 / Thinking` 추가 (2026-04-16)
   - `ChatInputArea.tsx`: `+` popover 안에 segmented control 추가
   - `AISidebarV4.tsx`, `EnhancedAIChat.tsx`, `useAISidebarStore.ts`: persistent state/setter 연결
2. [x] 프론트 transport payload에 `analysisMode` 전달 (2026-04-16)
   - `useAIChatCore.ts`, `useHybridAIQuery.ts`, `createHybridChatTransport.ts`
   - async job queue 경로(`useAsyncAIQuery.ts`, `/api/ai/jobs`)까지 metadata 전달
3. [x] 백엔드 `supervisor-mode` / `supervisor-routing`에 mode-aware heuristic 추가 (2026-04-16)
   - `auto`: 현행 자동 라우팅 유지
   - `thinking`: 인프라 문맥에서 `multi-agent` 우선
4. [x] `AnalysisBasisBadge`에 선택 모드 표시 (2026-04-16)
   - collapsed summary + expanded details에 analysis mode 노출

### Phase 2 로컬 검증

- root:
  - `npm run type-check` ✅
  - `npm run test:quick` ✅
  - `npm run lint` ✅
    - 기존 unrelated warning 1건 유지: `useChatHistory.ts` exhaustive-deps
- ai-engine:
  - `npm run type-check` ✅
  - `npm run test` ✅ (`71 files / 764 tests`)
- targeted:
  - `ChatInputArea.test.tsx` analysis mode selector ✅
  - `useQueryExecution.test.ts` thinking mode job-queue bias ✅
  - `supervisor-mode.test.ts` thinking heuristic ✅
  - `stream/v2 route` / `schemas` payload forwarding ✅
  - `AnalysisBasisBadge.test.tsx` mode 표시 ✅

### Phase 3 — 검증 및 문서화

1. 정책별 QA pack 추가
   - 지원 질문
   - 제한 지원 질문
   - 비지원 질문
2. `AI 전체 페이지` QA에 analysis mode 케이스 추가
3. public/product copy와 help text 동기화

## 6. 비용 영향 분석

### A안 — 현행보다 더 명확한 도메인 제한

- 장점:
  - 웹 검색/멀티에이전트 호출 감소
  - 토큰 사용량 감소
  - QA 범위 축소
  - 사용자 기대치와 실제 기능 일치
- 비용 영향:
  - **감소 또는 동일**

### B안 — 일반 질문 best-effort + 도메인 우선 정책

- 장점:
  - `AI 어시스턴트`로서의 기본 기대를 충족
  - 도메인 질문에서의 강점을 유지하면서 일반 질문도 수용 가능
- 단점:
  - 오프도메인 disclaimer, 라우팅, QA 기준이 추가로 필요
- 비용 영향:
  - **소폭 증가 또는 동일**
  - 단, 오프도메인 질문을 `single-agent + minimal tool path`로 제한하면 큰 비용 증가는 막을 수 있음

### 권장 결론

- OpenManager에는 `B안 + 분석 강도 모드`가 맞다.
- 범용 웹 assistant처럼 모든 질문을 깊게 처리하지는 않되, 일반 질문은 `best-effort`로 수용하고 도메인 질문에서 더 강하게 동작하도록 만든다.

## 7. 범위

### 포함

- 도메인 지원/확장 지원/일반 질문 정책
- 오프도메인 `best-effort` 응답 UX
- `Web 검색` 역할 재정의
- `오토 / Thinking` 응답 모드 설계

### 제외

- 범용 `날씨/잡학` assistant 전용 제품화
- 별도 general-purpose web mode 구현
- full spellcheck/autocorrect 파이프라인

## 8. 검증 계획

- 로컬:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - 관련 프론트/백엔드 단위 테스트 추가
- 최종 QA:
  - Vercel + Playwright
  - 케이스:
    - 지원 질문 정상 처리
    - 확장 지원 질문에서 웹 검색 근거 표시
    - 일반 질문에서 `best-effort + disclaimer` 동작 확인
    - `오토 / Thinking` 모드별 응답 경로 차이 확인

## 9. 종료 조건

- 오프도메인 질문이 `best-effort` 정책대로 일관되게 처리된다.
- `Web 검색`의 역할과 한계가 UI에서 이해 가능하다.
- `오토 / Thinking`이 UI/라우팅/분석 근거에 일관되게 반영된다.
- 관련 QA pack이 pass 한다.
