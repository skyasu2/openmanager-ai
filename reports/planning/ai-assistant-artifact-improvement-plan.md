> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-02

# AI Assistant Artifact Improvement Plan

- 상태: Approved — Phase 1~3 완료, Phase 4 Server Snapshot Artifact 구현 대기
- 작성일: 2026-05-02
- TODO.md 연결: Active Tasks > AI Assistant Server Snapshot Artifact Expansion

## 목표

AI Chat에서 명시적인 "장애 보고서 작성/다운로드" 또는 "이상감지/추세 분석" 요청이 들어오면 일반 LLM 답변을 만들지 않고 기존 기능 API를 직접 실행해 사용자-facing 아티팩트 카드로 반환한다.

## 범위

- 포함:
  - Chat 입력 단계의 명시적 아티팩트 intent 감지
  - 장애 보고서 작성 아티팩트: 기존 `/api/ai/incident-report` generate 경로 재사용
  - 이상감지/추세 아티팩트: 기존 `/api/ai/intelligent-monitoring` batch 경로 재사용
  - 사이드바와 전체 페이지 공통 메시지 렌더링
  - Markdown/Text 또는 Markdown/JSON 다운로드
  - 모호한 보고서/추세 언급은 API 호출 없이 기능 안내 CTA만 표시
- 제외:
  - 백그라운드 cron/자동 장애 감지
  - 초기 Phase 1 범위에서는 신규 LLM 호출 경로 추가 제외
  - Vercel AI Elements 도입
  - Pyodide 코드 실행 기능 확장
  - Cloud Run AI Engine 계약 변경

## 계약 (Contract)

### 변경 대상 파일

- `src/hooks/ai/useAIChatCore.ts`
- `src/lib/ai/chat-artifacts/chat-artifact-intent.ts`
- `src/lib/ai/chat-artifacts/incident-report-artifact.ts`
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`
- `src/components/ai/IncidentReportArtifactCard.tsx`
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`
- `src/components/ai-sidebar/SidebarMessage.tsx`
- `src/components/ai/AIWorkspaceMessage.tsx`
- `src/stores/useAISidebarStore.ts`
- `src/hooks/ai/core/useChatHistory.ts`
- `src/hooks/ai/utils/chat-history-storage.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `classifyChatArtifactIntent` | `string` | `none | incident-report | monitoring-analysis | guidance` | 없음, 보수적 분류 |
| `generateIncidentReportArtifact` | `{ queryAsOfDataSlot? }` | `IncidentReportArtifact` | 401/5xx 또는 invalid payload |
| `generateMonitoringAnalysisArtifact` | `{ queryAsOfDataSlot? }` | `MonitoringAnalysisArtifact` | 401/5xx 또는 invalid payload |
| `useAIChatCore.handleSendInput` | user text | user message + artifact assistant message | API 실패 시 assistant error message |

### 테스트 시나리오 (구현 전 확정)

- [x] 명시적 장애 보고서 요청은 `sendQuery`를 호출하지 않고 `/api/ai/incident-report`를 1회 호출해 `incidentReportArtifact` metadata를 가진 assistant message를 추가한다.
- [x] 명시적 추세 분석 요청은 `sendQuery`를 호출하지 않고 `/api/ai/intelligent-monitoring` batch를 1회 호출해 `monitoringAnalysisArtifact` metadata를 가진 assistant message를 추가한다.
- [x] 모호한 "장애 보고" 언급은 외부 API 호출 없이 안내 message만 추가한다.
- [x] 사이드바와 전체 페이지 메시지는 artifact metadata가 있으면 전용 카드와 다운로드 액션을 렌더링한다.
- [x] chat history 저장/복원 시 artifact metadata를 보존한다.

## Task 목록

- [x] Task 0 — failing test 추가 (아티팩트 intent, chat bypass, card render, history metadata)
- [x] Task 1 — intent 분류와 client artifact generator 구현
- [x] Task 2 — chat send pipeline에 아티팩트 bypass 연결
- [x] Task 3 — 공통 artifact card 렌더링과 다운로드 구현
- [x] Task 4 — history metadata 보존 및 검증
- [x] Task 5 — 품질 게이트 통과

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `feat:` | 선택 | ❌ | 필요 |
| Task 5 | — | 사용자 요청 시 | ❌ | 사용자 요청 시 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 사용량 증가 방지와 아티팩트 계약을 정확히 표현하는지 |
| Task 2 완료 후 | 명시 요청만 API를 호출하고 일반 Chat 경로를 침범하지 않는지 |
| 전체 완료 후 | UI/metadata/history/download/무료 티어 영향 |

---

## Phase 2 — Client-only Artifact Enrichment

### 목표

기존 아티팩트 생성 API 호출 횟수와 Cloud Run/LLM 사용량을 늘리지 않고, 이미 응답에 포함된 구조화 payload를 더 잘 보여준다.

### 범위

- 포함:
  - 장애 보고서 카드에 영향 서버 링크, 권장 조치, 이상 징후, 타임라인 요약 표시
  - 이상감지/추세 카드에 위험 신호, 근거 refs, 데이터 기준/source/freshness 표시
  - 모든 확장은 기존 `IncidentReportArtifact` / `MonitoringAnalysisArtifact` metadata만 소비
- 제외:
  - 신규 API route
  - 신규 LLM/provider 호출
  - Supabase 영속 저장
  - Sandpack/임의 React 실행 환경
  - Cloud Run AI Engine 계약 변경

### 계약 (Contract)

| 대상 | 입력 | 출력 | 비용/사용량 계약 |
|------|------|------|------------------|
| `IncidentReportArtifactCard` | 기존 `IncidentReportArtifact` | 같은 카드 안에 server link, recommendation, anomaly, timeline summary | 추가 fetch 없음 |
| `MonitoringAnalysisArtifactCard` | 기존 `MonitoringAnalysisArtifact` | 같은 카드 안에 risk signal, evidence ref, source metadata summary | 추가 fetch 없음 |

### 테스트 시나리오

- [x] 장애 보고서 카드가 `affectedServers`, `recommendations`, `anomalies`, `timeline`을 렌더링하고 서버 링크를 제공한다.
- [x] 이상감지/추세 카드가 `riskSignals`, `evidenceRefs`, `sourceMode`, `slot.timeLabel`을 렌더링한다.
- [x] 아티팩트 카드 렌더링 테스트는 API/fetch mock 없이 통과한다.

### Task 목록

- [x] Task 6 — failing card enrichment tests 추가
- [x] Task 7 — IncidentReport artifact card 상세/서버 링크 UI 구현
- [x] Task 8 — MonitoringAnalysis artifact card 위험 신호/근거 UI 구현
- [x] Task 9 — targeted/type/lint 검증 및 TODO 완료 기록

## Phase 3 — Intent Fallback Hardening

### 목표

짧은 한국어 키워드형 요청과 모호한 artifact 후보를 일반 Supervisor 채팅으로 흘리지 않도록 하되, 일반 운영 질문에는 추가 LLM 호출을 만들지 않는다.

### 범위

- 포함:
  - regex 1차 분류에 `reason` code 부여
  - `shouldUseLLMChatArtifactIntent()` 후보 게이트
  - Vercel `/api/ai/artifact-intent` route-local Mistral classifier (`ministral-3b-latest`)
  - classifier 대기 중 artifact loading UI 비활성 유지
  - abort 시 일반 Supervisor fallback 차단
  - `MISTRAL_MODEL_ID`는 Cloud Run AI Engine 전용 fallback override로 문서화
- 제외:
  - 전체 채팅 intent router를 LLM 기반으로 교체
  - Cloud Run Supervisor 계약 변경
  - Sandpack/임의 코드 실행형 artifact
  - Supabase artifact 저장 재도입

### 계약 (Contract)

| 단계 | 입력 | 출력 | 비용/사용량 계약 |
|------|------|------|------------------|
| Regex classifier | user query | `incident-report` / `monitoring-analysis` / `guidance` / `none` + reason | LLM 호출 0 |
| LLM candidate gate | regex `none` query | boolean | 일반 채팅은 LLM 호출 0 |
| `/api/ai/artifact-intent` | gated query | `{ kind }` | Mistral 3B 1회, 3초 timeout, rate limit 적용 |
| Artifact generation | confirmed artifact kind | artifact message metadata | 기존 artifact API 1회 |

### 테스트 시나리오

- [x] `장애보고서`, `추세 분석`, `이상감지`, `장애 예측 추세 분석` 같은 키워드형 요청을 artifact로 분류한다.
- [x] `추세`, `최근 추세가 어때?`, `추세 분석?` 같은 일반/질문형 요청은 artifact 실행으로 분류하지 않는다.
- [x] `/api/ai/artifact-intent`는 local gate, missing key, deterministic structured output, provider error fallback을 검증한다.
- [x] LLM intent 분류가 pending인 동안 `isLoading`을 켜지 않는다.
- [x] abort된 LLM intent 분류는 일반 Supervisor 채팅으로 fall through하지 않는다.

---

## Phase 4 — Server Snapshot Artifact Expansion

### 상태

Approved. 이 Phase는 신규 기능이므로 구현 전 `test(spec):` 커밋으로 failing contract tests를 먼저 추가한다.

### 베스트 프랙티스 및 외부 비교

조사일: 2026-05-02

| 출처 | 관찰 | OpenManager 적용 판단 |
|------|------|----------------------|
| [Claude Artifacts Help](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) | Artifact는 self-contained, 재사용/참조/반복 수정 가치가 있는 standalone content에 적합 | "현재 상태 스냅샷"은 채팅 밖에서 다시 볼 가치가 있는 독립 운영 산출물이므로 artifact 후보에 부합 |
| [Vercel AI SDK UI `useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) | AI SDK UI는 transport 기반 chat state/streaming 관리를 production surface로 제공 | 기존 `useAIChatCore` + message metadata 구조를 유지하고, RSC `streamUI`로 갈아타지 않음 |
| [Vercel AI SDK Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata) | metadata는 message-level 정보에 적합하고, data parts는 message content의 동적 구조 데이터에 적합 | 현재 artifact metadata 저장 방식은 적절. Phase 4도 metadata 기반으로 시작하고, streaming data part 전환은 보류 |
| [Vercel AI SDK Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) | tool/data/metadata가 포함된 message는 schema validation이 필요 | `chat-history-storage`, message transform, restored artifact fallback 테스트를 추가 |
| [Vercel AI SDK RSC Overview](https://ai-sdk.dev/docs/ai-sdk-rsc/overview) | RSC generative UI는 experimental이며 production은 AI SDK UI 권장 | `streamUI`/RSC artifact는 이번 범위에서 제외 |
| [OpenAI Apps SDK UI Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines) | inline card는 작은 구조화 데이터, quick status, single-purpose widget에 적합. primary action은 2개 이하 권장 | 서버 스냅샷은 inline card로 구현. 깊은 탭/내부 스크롤/복수 view 금지 |
| [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference) | tool result는 `structuredContent`와 component-only `_meta`를 분리하고 read-only hint를 명시 | 직접 MCP 앱은 아니지만, read-only structured payload + UI hydration 원칙을 내부 artifact contract에 반영 |
| [OpenAI Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) | 구조화 출력은 schema 일치를 강화하지만 값 자체의 의미 오류까지 막지는 못함 | LLM 기반 신규 artifact보다 deterministic OTel snapshot을 우선. LLM이 필요한 artifact는 schema + eval guard 후 별도 Phase |

### 현재 구현 상태 분석

| 영역 | 현재 상태 | Phase 4 영향 |
|------|----------|--------------|
| Artifact type | `IncidentReportArtifact`, `MonitoringAnalysisArtifact` 2종만 존재 (`src/lib/ai/chat-artifacts/types.ts`) | `ServerSnapshotArtifact` union 추가 필요 |
| Intent classifier | 2종 artifact + guidance + none. rule version/eval corpus/benchmark 존재 | broad `서버 상태`를 잡지 않고, `스냅샷/상태 카드/상태 리포트/다운로드` 같은 artifact-shaped 요청만 추가 |
| Generation | 기존 2종은 `/api/ai/incident-report`, `/api/ai/intelligent-monitoring` 호출 | Phase 4는 `MetricsProvider`/OTel static JSON만 사용. 신규 LLM/API/DB write 없음 |
| Rendering | `IncidentReportArtifactCard`, `MonitoringAnalysisArtifactCard`, `SidebarMessage`, `AIWorkspaceMessage` | `ServerSnapshotArtifactCard` 추가 및 공통 message render 분기 추가 |
| Persistence | chat history metadata 보존 및 legacy payload fallback 테스트 존재 | snapshot metadata restore fallback 테스트 추가 |
| Evaluation | 102개 intent corpus + precision/recall guard | corpus에 snapshot category를 추가하되 existing "현재 서버 상태 분석해줘" none 방어 유지 |

### 최근 변경 사항 분석 및 진입 판단

분석일: 2026-05-02

| 최근 변경 | 영향 | Phase 4 대응 |
|----------|------|--------------|
| `test(ai): improve artifact intent benchmark coverage`로 corpus 정본이 `tests/fixtures/artifacts/intent-corpus.ts`로 이동 | 새 artifact kind 추가 시 fixture, legacy re-export, benchmark wrapper를 함께 갱신해야 함 | Task 10-A에서 `server-snapshot` kind와 category support를 먼저 failing test로 고정 |
| `intent-classifier-metrics.ts`가 kind/category별 precision, recall, support를 계산 | `server-snapshot` 추가 시 confusion matrix와 min support 상수 미갱신 위험 | Task 10-A에서 `ARTIFACT_INTENT_EVALUATION_KINDS`, min support, threshold 조정을 테스트로 선행 |
| 일반 운영 분석 쿼리 false-positive 방어 케이스가 이미 포함됨 | `서버 상태` 계열 문구를 넓게 잡으면 최근 guard를 되돌릴 수 있음 | snapshot 실행 intent는 `스냅샷`, `카드`, `리포트`, `다운로드`, `export` token이 있는 경우로 제한 |
| Phase 1~3 아티팩트 경로가 message metadata 중심으로 안정화됨 | 새로운 artifact도 별도 streaming/data part 전환 없이 같은 패턴을 따라야 함 | `serverSnapshotArtifact` metadata 필드 추가와 history restore 테스트로 시작 |
| 기존 artifact generator 2종은 API 호출 기반 | snapshot generator가 같은 패턴을 무비판적으로 복사하면 Cloud Run/API 사용량 증가 | generator contract에 `fetch('/api/ai/...')` 금지와 `MetricsProvider` read-only 사용을 명시 |

진입 판단: Phase 4는 구현 가능하지만, 첫 커밋은 기능 구현이 아니라 contract/eval 테스트 확장이어야 한다. 특히 intent kind 확장은 classifier, corpus, metrics, chat metadata가 동시에 움직이므로 Task 10을 아래 4개 하위 단계로 나눈다.

### 후보 비교 및 결정

| 후보 | 사용자 가치 | 구현 리스크 | 무료 티어 영향 | 중복 위험 | 결정 |
|------|-------------|-------------|----------------|----------|------|
| Server Snapshot Artifact | 높음 — 매번 쓰는 현재 상태 요약 | 낮음 | 추가 LLM 0, Cloud Run 0, DB write 0 | 낮음 | 채택 |
| Runbook / Remediation Artifact | 높음 — 조치 절차 카드 | 중간 | Advisor/KB/LLM 호출 가능 | Advisor 응답과 중복 | Phase 5 후보 |
| Capacity Forecast Artifact | 중간~높음 | 중간 | 기존 monitoring API와 중복 호출 가능 | Monitoring Analysis와 중복 | Phase 6 후보 |
| Mermaid / Diagram Artifact | 중간 | 중간 | LLM 출력/렌더링 관리 필요 | 운영 기능과 거리 있음 | 보류 |
| Generic React/HTML Sandbox | 낮음(프로젝트 도메인 기준) | 높음 | 보안/QA/샌드박스 비용 큼 | 핵심 도메인 외 | 제외 |

### 목표

AI Chat에서 사용자가 명시적으로 "현재 서버 상태 스냅샷", "전체 인프라 상태 카드", "서버 상태 리포트 다운로드"처럼 운영 상태를 구조화 산출물로 요청하면, 일반 LLM 답변 대신 현재 OTel 데이터 슬롯을 읽어 read-only 서버 상태 스냅샷 아티팩트를 생성한다.

### 범위

- 포함:
  - `ServerSnapshotArtifact` 타입 추가
  - client-only generator `generateServerSnapshotArtifact()`
  - 서버 상태 스냅샷 카드 UI
  - MD/JSON 다운로드
  - 채팅 metadata/history/sidebar/fullscreen render 보존
  - intent corpus/eval에 snapshot artifact category 추가
- 제외:
  - 신규 API route
  - Cloud Run 호출
  - LLM/provider 호출
  - Supabase 저장
  - background cron/자동 생성
  - broad "서버 상태 알려줘" 일반 질문의 artifact 강제 전환
  - 차트 라이브러리 신규 도입
  - sandbox/임의 코드 실행

### 입출력 계약

| 함수/API | 입력 | 출력 | 비용/사용량 계약 |
|----------|------|------|------------------|
| `classifyChatArtifactIntent` | user query | `server-snapshot` 또는 기존 kind + reason + ruleVersion | LLM 호출 0 |
| `generateServerSnapshotArtifact` | `{ query, sessionId?, queryAsOfDataSlot? }` | `ServerSnapshotArtifact` | OTel static JSON fetch/cache만 사용 |
| `ServerSnapshotArtifactCard` | `ServerSnapshotArtifact` | inline card + MD/JSON download | 추가 fetch 없음 |
| `useAIChatCore.handleSendInput` | explicit snapshot query | user message + artifact assistant message | Supervisor/Cloud Run 호출 없음 |

### `ServerSnapshotArtifact` 초안

```ts
interface ServerSnapshotArtifact {
  kind: 'server-snapshot';
  generatedAt: string;
  title: string;
  summary: string;
  source: 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  slot: {
    slotIndex: number;
    minuteOfDay: number;
    timeLabel: string;
  };
  totals: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  averages: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  topServers: Array<{
    id: string;
    name: string;
    status: 'online' | 'warning' | 'critical' | 'offline';
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    primaryRisk: 'cpu' | 'memory' | 'disk' | 'network';
  }>;
  alerts: Array<{
    serverId: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    value: number;
    severity: 'warning' | 'critical';
    summary: string;
  }>;
}
```

### Intent 정책

실행으로 분류:

- `서버 상태 스냅샷`
- `전체 인프라 상태 카드로 보여줘`
- `현재 서버 상태 리포트 다운로드`
- `운영 현황 요약 카드 만들어줘`
- `server snapshot export`

일반 chat 유지:

- `서버 상태 알려줘`
- `CPU 높은 서버 알려줘`
- `현재 서버 상태 분석해줘`
- `서버 분석해줘`
- `CPU 높은 서버 원인 분석해줘`
- `서버 상태 스냅샷 기능 설명해줘`

### 테스트 시나리오

- [ ] `ServerSnapshotArtifact` 타입과 markdown/json download payload가 stable shape를 유지한다.
- [ ] generator는 `MetricsProvider`/OTel static data만 사용하고 `fetch('/api/ai/...')`, `sendQuery`, Cloud Run route를 호출하지 않는다.
- [ ] explicit snapshot queries는 `server-snapshot`으로 분류한다.
- [ ] 일반 운영 질문과 원인 분석 질문은 `none`으로 유지한다.
- [ ] guidance query는 local guidance로 처리한다.
- [ ] `useAIChatCore`는 server snapshot 요청에서 `sendQuery`를 호출하지 않고 artifact metadata message를 추가한다.
- [ ] Sidebar/Workspace가 `ServerSnapshotArtifactCard`를 렌더링한다.
- [ ] chat history 저장/복원 시 snapshot artifact metadata가 보존되고 legacy optional field 누락에 방어적으로 렌더링한다.
- [ ] intent evaluation corpus에 `server-snapshot` category를 추가하고 all-kind precision/recall threshold를 유지한다.

### Task 목록

- [ ] Task 10 — `test(spec): server snapshot artifact contract`
  아래 10-A~10-D를 같은 test/spec 단계로 묶어 구현 전 계약을 먼저 고정.
- [ ] Task 10-A — `test(spec): server snapshot intent corpus contract`
  `server-snapshot` kind, 실행/비실행 query, category support, precision/recall guard를 failing test로 추가.
- [ ] Task 10-B — `test(spec): server snapshot data contract`
  `ServerSnapshotArtifact` 타입, generator output, MD/JSON download payload, API/LLM 호출 금지 contract를 failing test로 추가.
- [ ] Task 10-C — `test(spec): server snapshot card contract`
  inline card totals, averages, top servers, alerts, server detail link, defensive legacy render를 failing test로 추가.
- [ ] Task 10-D — `test(spec): server snapshot chat persistence contract`
  `useAIChatCore` bypass, `serverSnapshotArtifact` metadata, Sidebar/Workspace render, chat history 저장/복원 failing test를 추가.
- [ ] Task 11 — `feat: server snapshot artifact data model and generator`
  `types.ts`, `server-snapshot-artifact.ts`, OTel/MetricsProvider 기반 summary builder 구현.
- [ ] Task 12 — `feat: render server snapshot artifact card`
  `ServerSnapshotArtifactCard`, MD/JSON download, server detail links, compact inline layout 구현.
- [ ] Task 13 — `feat: route explicit snapshot artifact intents`
  classifier kind/reason/corpus/eval/benchmark 갱신. broad query false-positive 방어.
- [ ] Task 14 — `feat: wire snapshot artifact into chat surfaces`
  `useAIChatCore`, `SidebarMessage`, `AIWorkspaceMessage`, metadata/history transform 갱신.
- [ ] Task 15 — `docs/test: record snapshot artifact rollout`
  architecture/docs/TODO 반영, targeted + smoke + production QA 계획 기록.

### 사이드 이펙트 및 방어책

| 위험 | 원인 | 방어 |
|------|------|------|
| 일반 서버 상태 질문 오탐 | snapshot keyword가 너무 넓음 | `스냅샷`, `카드`, `리포트`, `다운로드`, `export` 등 artifact-shaped token 요구 |
| 기존 intent precision 하락 | artifact kind 증가 | corpus category별 support/precision guard 유지 |
| UI 카드 과밀 | 서버 18대 전체를 inline에 표시 | totals + averages + top 3 + alert 3개만 inline, 전체는 JSON/MD 다운로드 |
| 데이터 슬롯 불일치 | dashboard와 artifact가 다른 KST slot 사용 | `queryAsOfDataSlot` 우선, 없으면 MetricsProvider KST slot 사용 |
| 사용량 증가 | 신규 API/LLM 호출 추가 | 신규 API/LLM/DB 금지, static OTel read-only만 허용 |
| 메시지 복원 실패 | old metadata shape | Zod 또는 defensive reader + legacy fallback 테스트 |

### 검증 계획

- Targeted:
  - `npx vitest run src/lib/ai/chat-artifacts/chat-artifact-intent.test.ts`
  - `npx vitest run tests/intent-classifier/intent-classifier.eval.test.ts tests/artifacts/intent-classifier.bench.ts`
  - `npx vitest run src/lib/ai/chat-artifacts/server-snapshot-artifact.test.ts src/components/ai/ArtifactCards.test.tsx src/hooks/ai/useAIChatCore.test.ts`
  - `npx vitest run src/hooks/ai/utils/chat-history-storage.test.ts src/hooks/ai/utils/message-transform-internals.test.ts`
- Standard:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - `npm run docs:budget`
  - `git diff --check`
- Production QA:
  - Vercel + Playwright MCP에서 `서버 상태 스냅샷` 입력
  - Network: `/api/ai/supervisor/stream/v2`, `/api/ai/incident-report`, `/api/ai/intelligent-monitoring` 미호출 확인
  - UI: card totals/top servers/download action 확인
  - QA tracker 기록
