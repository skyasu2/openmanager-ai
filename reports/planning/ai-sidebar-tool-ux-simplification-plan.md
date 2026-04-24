> Owner: project
> Status: Draft
> Last reviewed: 2026-04-24

# AI Sidebar Tool and UX Simplification Plan

## 1. 목적

AI 사이드바의 RAG, Web Search, Thinking, 파일 첨부, Reporter, Analyst 기능을
사용자 관점의 명확한 계약과 단순한 정보 구조로 정리한다.

목표는 기능을 많이 보여주는 것이 아니라, 면접관이나 신규 사용자가 봤을 때
"각 컨트롤이 무엇을 하고 실제로 동작한다"는 신뢰를 주는 표면을 만드는 것이다.

## 2. 현재 판단

### 잘 유지할 부분

| 영역 | 판단 | 근거 |
|------|------|------|
| 공통 채팅 코어 | 유지 | `useAIChatCore`가 sidebar/fullscreen의 공통 상태를 제공한다. |
| lazy feature mount | 유지 | `AIContentArea`가 Reporter/Analyst를 필요 시 lazy load하고 Activity로 상태를 보존한다. |
| 파일 첨부 UX | 유지 후 문구 정리 | 이미지/PDF/MD 입력과 preview/remove 흐름이 이미 구분되어 있다. |
| 분석 근거 표시 | 유지 | RAG badge, web source card, analysis basis가 답변 신뢰도를 높인다. |

### 개선 필요 리스크

| 우선순위 | 리스크 | 현재 증거 | 개선 방향 |
|----------|--------|-----------|-----------|
| P1 | Job Queue 경로에서 RAG/Web 토글 계약이 약하다 | Streaming 경로는 `enableRAG`, `enableWebSearch`, `analysisMode`를 전달하지만 async job 경로는 `analysisMode` 중심이다. | async job create/process 계약에 RAG/Web 옵션을 명시 전달하고 테스트로 고정한다. |
| P2 | Thinking 라벨이 provider-native reasoning처럼 보일 수 있다 | UI는 `Thinking`, backend는 app-level `analysisMode='thinking'` 기반 라우팅/심층 분석이다. | 라벨을 `심층 분석` 중심으로 정리하고 tooltip에서 "더 긴 분석 경로"임을 설명한다. |
| P2 | RAG/Web이 "켜짐"과 "실제로 사용됨"을 구분하지 못한다 | 입력 영역 badge는 enabled만 보여주고, 답변 이후 used/suppressed/unavailable 상태가 분리되어 있지 않다. | enabled, used, suppressed, unavailable 상태를 UI/metadata로 분리한다. |
| P2 | 사이드바 표면에 기능이 많아 조잡해 보일 수 있다 | Chat, Reporter, Analyst, fullscreen, RAG, Web, Thinking, file attach, analysis basis가 한 표면에 있다. | 기본은 chat-first로 두고 고급 기능은 명확한 2차 액션 또는 fullscreen workspace로 분리한다. |
| P2 | sidebar와 fullscreen 배선 중복 | `AISidebarV4`와 `AIWorkspace`가 selected function, chat props, toggle props를 각각 배선한다. | 공통 `AIChatSurface`/adapter로 chat prop bundle을 만든다. |
| P3 | 시각 신호가 과하다 | icon rail의 gradient, emoji tooltip, pulse status, 여러 컬러 badge가 동시에 노출된다. | 컬러 수를 줄이고 상태 신호는 실제 engine/tool 상태에만 사용한다. |

## 3. 범위

### 포함

- RAG/Web/Thinking 토글의 실제 동작 계약 정리
- sidebar, fullscreen, async job 경로의 옵션 전달 일관성 확보
- sidebar 정보 구조 평가 및 축소안 설계
- 현재 UI가 "잘 만든 제품"으로 보이는지에 대한 code-review 관점 평가 기준 추가
- 구현 전 failing test 목록 작성
- 필요 시 1회 이하의 targeted Vercel QA 계획

### 제외

- 신규 AI provider 추가
- RAG 지식베이스 자체 확장
- Reporter/Analyst 기능 삭제
- 전면 디자인 리브랜딩
- Draft 단계에서 production LLM/Playwright 반복 QA 수행

## 4. 기준 계약

### Tool option contract

| 옵션 | 의미 | 기대 동작 |
|------|------|-----------|
| `enableRAG` | 내부 지식베이스 검색 허용 | knowledge base/incident/best practice 문맥이 필요한 경우만 사용한다. |
| `enableWebSearch` | 외부 최신 정보 검색 허용 | CVE, 최신 문서, 릴리스, 외부 장애 정보처럼 최신성이 필요한 경우만 사용한다. |
| `analysisMode='thinking'` | 심층 분석 경로 선호 | provider-native hidden reasoning이 아니라 더 긴 분석/라우팅/async 처리 경로를 의미한다. |
| 파일 첨부 | 사용자 제공 파일/이미지 분석 | 첨부 파일이 있을 때는 파일 근거를 우선 표시하고 RAG/Web과 구분한다. |

### UI status contract

| 상태 | 표시 의미 |
|------|-----------|
| `enabled` | 사용자가 해당 도구 사용을 허용했다. |
| `used` | 이번 답변에서 실제로 사용됐다. |
| `suppressed` | warmup, 비용, 쿼리 성격, 비활성 환경 때문에 의도적으로 사용하지 않았다. |
| `unavailable` | API key, provider, backend 상태 때문에 사용할 수 없다. |

## 5. UI/UX 평가 기준

다음 기준 중 하나라도 실패하면 "기능은 많은데 조잡해 보이는" 상태로 판단한다.

| 기준 | 합격 기준 |
|------|-----------|
| One sentence test | 사이드바 목적을 "서버 운영 질문을 묻고 근거 있는 답을 받는 공간"으로 한 문장 설명 가능 |
| Ghost control test | 켠 토글은 request path에서 실제 옵션으로 전달되거나, 미사용 사유가 노출됨 |
| Primary action test | 처음 보는 사용자가 5초 안에 입력창과 전송 버튼을 찾음 |
| Feature density test | 기본 sidebar에서 핵심 행동은 chat, attach, tool options, fullscreen 정도로 제한 |
| Visual hierarchy test | status color는 실제 상태 의미가 있을 때만 사용하고 장식용 gradient/pulse는 줄임 |
| Interviewer test | "기능 나열"보다 "계약, 근거, 비용 제어가 명확하다"는 인상을 줌 |

## 6. 설계 선택지

### 선택지 A - 보수적 정리

- 현재 Chat/Reporter/Analyst 3개 기능은 유지한다.
- icon rail의 색상/tooltip/status 표현을 단순화한다.
- RAG/Web/Thinking 문구와 상태 표시만 개선한다.
- 구현 비용이 낮고 회귀 위험이 작다.

### 선택지 B - Chat-first sidebar

- sidebar 기본 표면은 Chat 중심으로 둔다.
- Reporter/Analyst는 "고급 분석" 그룹 또는 fullscreen workspace에서 강조한다.
- 작은 sidebar 안에서 기능이 많아 보이는 문제를 더 강하게 줄인다.
- IA 변경이므로 사용자 동선 회귀 테스트가 더 필요하다.

### 권장 초안

1차 구현은 선택지 A로 계약과 문구를 먼저 안정화한다.
이후 실제 QA/리뷰에서 여전히 조잡해 보이면 선택지 B를 별도 승인 작업으로 분리한다.

## 7. SDD 진행 계획

### Task 0 - 검토 게이트

- [ ] 이 Draft 계획서를 Claude Code/Gemini CLI 검토에 전달한다.
- [ ] `Status: Approved` 전환 전까지 구현 파일을 수정하지 않는다.
- [ ] 선택지 A/B 중 1차 범위를 확정한다.

### Task 1 - failing tests 먼저 추가

- [ ] async job 생성 시 `enableRAG`, `enableWebSearch`, `analysisMode`가 함께 전달되는 테스트 추가
- [ ] Cloud Run job process payload가 RAG/Web 옵션을 보존하는 테스트 추가
- [ ] ChatInputArea가 `Thinking` 단독 라벨보다 `심층 분석` 의미를 보여주는 테스트 추가
- [ ] RAG/Web badge가 enabled와 used를 혼동하지 않는 UI 테스트 추가

예상 커밋:

```text
test(spec): ai sidebar tool contract add failing tests
```

### Task 2 - RAG/Web option propagation 구현

- [ ] `useAsyncAIQuery`와 `useQueryExecution`에서 tool options 전달
- [ ] `/api/ai/jobs` 요청 schema와 job payload 확장
- [ ] Cloud Run `jobs/process` 처리 경로에서 supervisor/orchestrator까지 options 전달
- [ ] 기존 streaming 경로와 동일한 의미를 유지

예상 커밋:

```text
feat: align ai sidebar tool options across async jobs
```

### Task 3 - RAG/Web/Thinking copy와 상태 정리

- [ ] `Thinking` UI를 `심층 분석` 중심으로 변경하고 보조 설명 추가
- [ ] RAG 설명을 "과거 장애 이력"보다 넓은 "내부 운영 지식/장애 이력"으로 정리
- [ ] Web 설명을 "최신 외부 정보"로 정리
- [ ] 답변 metadata에서 used/suppressed/unavailable 표시 가능성 검토

예상 커밋:

```text
fix: clarify ai sidebar tool mode semantics
```

### Task 4 - sidebar 시각/정보 구조 단순화

- [ ] icon rail에서 장식용 gradient/pulse/emoji tooltip 축소
- [ ] 실제 engine/tool 상태와 무관한 "AI 활성" 신호 제거 또는 의미 재정의
- [ ] 모바일에서 기능 전환과 채팅 입력이 충돌하지 않는지 확인
- [ ] 선택지 B가 필요하면 별도 plan으로 승격

예상 커밋:

```text
refactor: simplify ai sidebar feature navigation
```

### Task 5 - sidebar/fullscreen 중복 배선 축소

- [ ] `AISidebarV4`와 `AIWorkspace`의 chat prop bundle 중복을 추출
- [ ] selected function/entry state/fullscreen handoff 책임 경계를 문서화
- [ ] 파일 첨부, RAG/Web/Thinking toggle props가 한 곳에서 정의되도록 정리

예상 커밋:

```text
refactor: extract shared ai chat surface contract
```

### Task 6 - 검증

- [ ] `npx vitest run src/components/ai-sidebar/ChatInputArea.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai/AIWorkspace.test.tsx`
- [ ] `npx vitest run src/hooks/ai/useAsyncAIQuery.test.ts src/hooks/ai/core/useQueryExecution.test.ts`
- [ ] `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts`
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] 필요 시 `npm run test:quick`

### Task 7 - targeted QA

- [ ] 로컬 계약 검증이 통과한 뒤에만 Vercel QA 실행 여부를 결정한다.
- [ ] Vercel QA는 비용/사용량을 고려해 단일 smoke run으로 제한한다.
- [ ] 대상은 sidebar chat: 기본 질의, RAG ON, Web ON, 심층 분석 ON, fullscreen 전환이다.
- [ ] 실행 시 `reports/qa`에 `qa:record`로 남기고 `qa:evidence:audit` 확인.

## 8. 완료 조건

- [ ] RAG/Web/Thinking 옵션이 streaming과 async job 경로에서 동일하게 해석된다.
- [ ] UI가 enabled와 actually used를 혼동하지 않는다.
- [ ] 기본 sidebar에서 핵심 행동이 chat-first로 보인다.
- [ ] `AISidebarV4`와 `AIWorkspace`의 중복 배선이 감소한다.
- [ ] 로컬 검증이 통과한다.
- [ ] production QA를 수행했다면 QA tracker와 evidence audit가 clean 또는 accepted 상태다.

## 9. 검토 질문

다른 AI 검토자는 아래 질문에 답한다.

| 질문 | 선택지 |
|------|--------|
| 1차 범위는 선택지 A로 충분한가? | A 유지 / B로 확대 |
| Thinking 라벨은 `심층 분석`으로 바꾸는 것이 적절한가? | 변경 / 유지 / 병기 |
| RAG/Web used 상태는 답변 metadata 기반으로 표시할 수 있는가? | 즉시 구현 / 후속 작업 |
| Reporter/Analyst는 sidebar에 계속 1급 기능으로 둘 것인가? | 유지 / fullscreen 중심 |
| Vercel QA는 구현 후 1회 smoke로 충분한가? | 충분 / 추가 필요 |
