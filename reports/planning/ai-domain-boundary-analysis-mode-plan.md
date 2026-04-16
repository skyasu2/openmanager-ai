> Owner: project
> Status: Backlog
> Doc type: Plan
> Last reviewed: 2026-04-16
> Tags: ai-assistant,domain-boundary,analysis-mode,web-search

# AI Domain Boundary & Analysis Mode Plan

- 상태: **Backlog** — 정책/UX 설계 완료 전까지 현행 라우팅 유지
- 작성일: 2026-04-16
- TODO.md 연결: Backlog > AI Domain Boundary & Analysis Mode
- 목표: OpenManager AI를 `서버 운영/모니터링 특화 어시스턴트`로 더 선명하게 정의하고, 지원 범위와 분석 강도를 사용자에게 설명 가능한 방식으로 노출한다.

## 1. 배경

- 현재 시스템 프롬프트와 도구 구성을 보면 OpenManager AI의 정체성은 이미 `서버 모니터링 AI 어시스턴트`에 가깝다.
  - [supervisor-routing.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts:31)
- 반면 UI에는 `Web 검색` 토글이 열려 있고, `searchWeb` 도구 설명은 일반 질문에도 활용 가능하다고 적혀 있다.
  - [ChatInputArea.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/ChatInputArea.tsx:252)
  - [web-search.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/web-search.ts:83)
- 이 상태는 기술적으로는 동작할 수 있지만, 제품 관점에서는 다음 문제가 있다.
  - 도메인 밖 질문(`날씨`, `운세`, 일반 잡학`)에 대한 정책이 불명확하다.
  - `thinking` 표시 UI는 있지만, 분석 강도를 사용자가 명시적으로 선택할 수 없다.
  - `searchWeb`의 역할이 `기술/운영 최신 정보 검색`인지 `범용 웹 검색`인지 문서/UX에서 일관되지 않다.

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
- 결과적으로 오프도메인 질문은 `정식 지원`도 아니고 `하드 거절`도 아닌 애매한 상태다.

### 2.3 분석 강도 UX

- 현재 있는 것:
  - `submitted / streaming / ready / error` 상태 머신
  - `ThinkingProcessVisualizer`
  - `AnalysisBasisBadge`
- 현재 없는 것:
  - `빠르게 / 표준 / 깊게` 같은 명시적 분석 강도 토글
  - reasoning budget 또는 multi-agent 강제 여부를 사용자에게 보여주는 모드 UI

## 3. 공식 베스트 프랙티스 기준

### A. Google PAIR / Microsoft Transparency

- 사용자는 시스템이 무엇을 잘하고, 무엇을 하지 않는지 이해할 수 있어야 한다.
- intended use와 limitations가 UI/동작 정책에 반영되어야 한다.
- 정리:
  - OpenManager는 `운영 특화 AI`라는 intended use를 분명히 드러내야 한다.
  - 도메인 밖 질문에는 범위 제한을 명시하는 편이 신뢰 측면에서 낫다.
- 참고:
  - https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/
  - https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note

### B. Anthropic / OpenAI Agent 설계

- 복잡한 에이전트 구조와 과도한 도구 수는 비용/지연/불확실성을 키운다.
- 단순한 도구 세트와 선명한 역할 정의가 더 안정적으로 동작한다.
- 정리:
  - 범용 질문까지 억지로 같은 에이전트에 넣는 것보다 도메인 경계를 분명히 하는 편이 비용과 품질 모두 유리하다.
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
| 제한 지원 | 최신 CVE, 기술 문서, 보안 공지, 운영 관련 외부 정보 | `기술 웹 검색` 기반 처리 |
| 비지원 | 날씨, 운세, 일반 잡학, 생활형 상담 | 정중한 제한 응답 + 도메인 내 질문 유도 |

### 4.2 분석 강도

| 모드 | 의도 | 권장 라우팅 |
|------|------|-------------|
| 빠르게 | 짧은 운영 요약, 즉시 판단 | `single-agent` 우선, tool 최소화, streaming 우선 |
| 표준 | 현재 기본 운영 질문 | 현행 자동 라우팅 유지 |
| 깊게 | RCA/리포트/비교 분석/교차 검증 | `multi-agent` 허용, RAG 기본 ON 고려, Job Queue 허용 |

## 5. 구현 전략

### Phase 1 — 도메인 경계 명시 (우선)

1. 오프도메인 질문 감지 규칙 추가
   - `날씨`, `운세`, 일반 생활형 패턴은 명시적 비지원 분기로 이동
2. 제한 응답 UX 추가
   - “이 제품은 서버 운영/모니터링 전용입니다.”
   - “원하면 서버 상태, 장애 원인, 기술 문서 질문으로 바꿔 드리겠습니다.”
3. `Web 검색` 라벨/설명 정리
   - `기술 웹 검색` 또는 `운영/기술 최신 정보 검색`
4. 지원 범위 안내 문구 추가
   - 입력창 도움말 또는 welcome prompt에 명시

### Phase 2 — 분석 강도 모드 추가

1. UI에 `빠르게 / 표준 / 깊게` 추가
2. 프론트 transport payload에 `analysisMode` 전달
3. 백엔드 `supervisor-mode` / `supervisor-routing`에 mode-aware heuristic 추가
4. `AnalysisBasisBadge`에 선택 모드 표시

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

### B안 — 범용 웹 모드 별도 추가

- 장점:
  - 일반 질문 정식 수용 가능
- 단점:
  - tool set, prompt, QA matrix, explainability UI가 별도 관리 대상이 됨
- 비용 영향:
  - **증가**
  - 웹 검색 호출 증가
  - 문서/QA/운영 복잡도 증가

### 권장 결론

- OpenManager에는 `A안 + 분석 강도 모드`가 맞다.
- 범용 웹 assistant는 같은 제품 흐름에 섞지 않는 편이 낫다.

## 7. 범위

### 포함

- 도메인 지원/비지원 정책
- 오프도메인 질문 제한 UX
- `Web 검색` 역할 재정의
- `빠르게 / 표준 / 깊게` 분석 강도 설계

### 제외

- 범용 `날씨/잡학` assistant 정식 구현
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
    - 제한 지원 질문에서 `기술 웹 검색` 근거 표시
    - 비지원 질문에서 정중한 제한 응답
    - `빠르게 / 표준 / 깊게` 모드별 응답 경로 차이 확인

## 9. 종료 조건

- 오프도메인 질문이 정책대로 일관되게 제한된다.
- `Web 검색`이 범용 검색이 아니라 기술/운영 최신 정보용으로 인지된다.
- `빠르게 / 표준 / 깊게`가 UI/라우팅/분석 근거에 일관되게 반영된다.
- 관련 QA pack이 pass 한다.
