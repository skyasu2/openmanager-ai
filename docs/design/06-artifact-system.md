# 아티팩트 시스템 설계

> Chat Artifact 생성·분류·렌더링·재현 파이프라인 전체를 설명하는 구현 기준 설계
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-15
> Canonical: docs/design/06-artifact-system.md
> Tags: design,ai,artifact,chat,workspace

---

## 개요

아티팩트 시스템은 AI 채팅 응답의 일부로 구조화된 운영 결과물(보고서, 분석 카드, 절차서)을 생성·표시·재현하는 파이프라인입니다. LLM 스트림 응답과 별개로, 타입이 고정된 JSON 페이로드를 기준으로 계약합니다.

```text
사용자 쿼리
  ↓
Intent Classifier (결정론적 regex → LLM fallback)
  ↓
Artifact Execution (Cloud Run AI Engine 또는 deterministic)
  ↓
ArtifactEnvelope (versioned JSON)
  ↓
ArtifactRendererHost → ArtifactCard 컴포넌트
  ↓
ArtifactWorkspacePanel (export / import / replay 비교)
```

---

## 아티팩트 종류 (5종)

| kind | 트리거 | 생성 방식 |
|------|--------|-----------|
| `incident-report` | 채팅 intent: `장애 보고서 작성해줘` | Cloud Run Reporter Agent (LLM) |
| `monitoring-analysis` | 채팅 intent: `이상감지 돌려줘` | Cloud Run Analyst Agent (LLM) |
| `server-monitoring-analysis` | 서버 상세 탭 "분석" 버튼, 채팅 intent: `web-server-01 이상감지 분석해줘` | Cloud Run `/analyze/server` (LLM) |
| `server-snapshot` | 채팅 intent: `서버 상태 스냅샷` | **결정론적** — metricsProvider 직접 집계 |
| `ops-procedure` | 채팅 intent: `bash 스크립트 짜줘`, `runbook 작성` | **결정론적** — metricsProvider + 템플릿 빌더 |

계약 버전은 `ARTIFACT_CONTRACT_VERSION` 상수(`src/lib/ai/chat-artifacts/types.ts`)로 중앙 관리합니다.

### 실행 경로 분류

```text
Cloud Run LLM 의존 (3종)
├── incident-report        채팅 → /api/ai/incident-report → Reporter Agent
├── monitoring-analysis    채팅 → /api/ai/intelligent-monitoring → Analyst Agent
└── server-monitoring-analysis  탭 버튼 또는 채팅 serverId/alias intent → Cloud Run /analyze/server

결정론적 (2종, LLM 없음, < 200ms)
├── server-snapshot        채팅 → metricsProvider.getAllServerMetrics() 직접 집계
└── ops-procedure          채팅 → metricsProvider + buildRunbookBlock/buildScriptBlock 템플릿
```

`server-snapshot`과 `ops-procedure`는 외부 호출이 없어 Cold Start 영향을 받지 않으며 Cloud Run 할당량을 소비하지 않습니다.

---

## Intent 분류기

**경로**: `src/lib/ai/chat-artifacts/chat-artifact-intent.ts`

두 단계로 처리합니다.

1. **결정론적 regex** (`classifyChatArtifactIntent`): 부정 패턴 → formatting-only 패턴 → ops-procedure 패턴 → server-snapshot → server-monitoring-analysis → incident-report → monitoring-analysis 순으로 우선순위 평가
2. **LLM fallback** (`fetchLLMChatArtifactIntent`): regex가 `none`을 반환하고 `shouldUseLLMChatArtifactIntent`가 true일 때 `/api/ai/artifact-intent`를 호출

`guidance` kind는 artifact를 즉시 실행하지 않고, 올바른 실행 방법을 안내하는 텍스트를 반환하는 인텐트입니다.

### 분류 결과 타입

```typescript
type ChatArtifactIntent =
  | { kind: 'none' }
  | { kind: 'incident-report'; reason: ... }
  | { kind: 'monitoring-analysis'; reason: ... }
  | { kind: 'server-monitoring-analysis'; serverId: string; serverName?: string; reason: ... }
  | { kind: 'server-snapshot'; reason: ... }
  | { kind: 'ops-procedure'; procedureType: 'runbook' | 'alert-rule' | 'script'; reason: ... }
  | { kind: 'guidance'; target: 'incident-report' | 'monitoring-analysis'; reason: ... }
```

---

## 저장 정책

`ArtifactReplayPolicy`가 모든 artifact 종류에 공통으로 적용됩니다.

```typescript
{
  persistence: 'local-session-first',
  allowsDatabaseWritesByDefault: false,
  compareStrategy: 'stable-json',
}
```

- **local-session-first**: 세션 내 메모리(React state)에 보관, 브라우저 새로고침 후 소멸
- **allowsDatabaseWritesByDefault: false**: Supabase 기록은 기본 비활성 (인프라는 준비됨)
- **stable-json**: 키 정렬 후 JSON 직렬화 비교로 순서 무관한 구조 동등성 검사

---

## 재현(Replay) 팩

`ArtifactWorkspacePanel`은 세션 내 아티팩트를 JSON 파일로 내보내고, 다른 세션에서 불러와 비교할 수 있습니다.

- `createArtifactReplayPack`: 현재 채팅 히스토리 → replay pack JSON
- `compareArtifactReplayPacks`: `matched / missing / added / changed` 배열 반환
- 파일명: `artifact-replay-{workspaceId}.json`

이 기능은 QA 회귀 검증과 Vercel Preview 환경 간 artifact 동등성 확인에 사용됩니다.

---

## 렌더링 구조

```text
ArtifactRendererHost         ← metadata unknown 입력, 멀티 entry 지원
  └─ resolveArtifactRendererEntries (registry 조회)
       ├─ supported → 각 ArtifactCard 컴포넌트 선택
       │    ├─ IncidentReportArtifactCard
       │    ├─ MonitoringAnalysisArtifactCard
       │    ├─ ServerMonitoringAnalysisArtifactCard
       │    ├─ ServerSnapshotArtifactCard
       │    └─ OpsProcedureArtifactCard
       └─ unsupported → UnsupportedArtifactFallback (amber 경고 박스)
```

모든 ArtifactCard는 Markdown(`.md`) 및 JSON(`.json`) 포맷 다운로드를 제공합니다.

---

## 설계 결정 근거

### JSON 구조체 아티팩트 (vs. 인터랙티브 코드 실행)

아티팩트를 "실행 가능한 코드"가 아닌 "타입이 고정된 JSON 구조체"로 설계한 이유:

1. **도메인 적합성**: 서버 모니터링 결과물은 텍스트·수치 중심이며 인터랙티브 코드 실행이 필요하지 않습니다.
2. **계약 안정성**: TypeScript 타입과 runtime isPayload 가드로 보장되는 명시적 계약이 LLM hallucination을 차단합니다.
3. **비용 제약**: Vercel Pro 예산 내에서 서버 사이드 sandboxing 없이 동작합니다. Claude Artifacts 방식의 `<iframe>` sandboxing은 기술적으로 가능하지만 이 도메인에서 추가 가치가 없습니다.
4. **테스트 가능성**: JSON 구조체이므로 Vitest 단위 테스트로 artifact 계약 회귀를 완전히 검증할 수 있습니다.

### local-session-first (vs. 즉시 Supabase 기록)

- **현재**: Supabase 스키마와 Edge 인프라는 준비됨, 기본값만 false
- **이유**: 무분별한 DB 쓰기는 cold-start 지연과 비용을 발생시키며, 대부분의 사용 패턴에서 세션 내 재현으로 충분합니다.
- **전환 조건**: 사용자 세션 간 아티팩트 지속 요구가 명확해질 때 `allowsDatabaseWritesByDefault`를 per-kind로 활성화합니다.

---

## 알려진 설계 갭 (백로그)

아래 미완료 항목은 추가 인프라 없이 구현 가능하며, 우선순위가 생기면 TODO.md Backlog에서 승격합니다.

### G2: guidance intent → 인라인 CTA 버튼 없음

- **현상**: intent가 `guidance`로 분류되면 "직접 요청해 주세요" 텍스트만 반환합니다. 사용자가 의도를 명확히 했음에도 한 번 더 타이핑해야 합니다.
- **해결 방향**: guidance 응답 렌더러에 "바로 장애 보고서 생성하기" 같은 quick-action 버튼을 추가합니다. 버튼 클릭이 해당 artifact 실행 함수를 직접 호출합니다.

### G3: ops-procedure 품질이 템플릿 범위에 묶임

- **현상**: `generateOpsProcedureArtifact`는 LLM을 호출하지 않고 `buildRunbookBlock`, `buildScriptBlock`, `buildAlertRuleBlocks` 등 정적 템플릿 함수로 결과물을 조립합니다. "디스크 90% 초과 시 로그 정리 후 알람 보내는 runbook"처럼 맥락이 구체적인 요청도 템플릿 범위를 벗어난 맞춤화는 없습니다.
- **원인**: 결정론적 경로를 선택해 Cloud Run 비용과 Cold Start 지연을 피한 의도적 트레이드오프입니다.
- **해결 방향**: Advisor Agent(Cloud Run)를 ops-procedure 생성 경로에 선택적으로 연결합니다. 단, Cloud Run 호출이 추가되므로 할당량과 지연 영향을 사전에 검토해야 합니다. 현재 우선순위 낮음.

### G4: incident-report·monitoring-analysis 생성 중 진행 피드백 없음

- **현상**: Cloud Run 호출이 3~10초 걸리는데 UI에 스피너만 표시됩니다. 일반 채팅의 스트리밍 응답과 비교해 UX 낙차가 큽니다.
- **해결 방향**: 생성 시작 → "분석 중…" → "보고서 작성 중…" → 완료 순서의 단계 메시지를 채팅 버블에 표시합니다. SSE 또는 낙관적 메시지 삽입으로 구현합니다.

---

## 해결된 설계 갭

### G1: server-monitoring-analysis 채팅 경로

- **완료**: 2026-05-15
- **해결**: `chat-artifact-intent.ts`가 명시적 서버 ID 또는 운영자 친화 alias(`web-server-01` 등)를 감지하면 `server-monitoring-analysis` intent를 반환합니다. `server-registry.ts`의 alias resolver가 alias를 canonical serverId(`web-nginx-dc1-01` 등)로 정규화하므로 채팅 경로와 서버 상세 탭 경로가 같은 `executeChatArtifact('server-monitoring-analysis', ...)` 실행 계약을 사용합니다.

### G5: workspace 비교 패널 세부 라벨

- **완료**: 2026-05-15
- **해결**: `ArtifactWorkspacePanel` 비교 결과가 count만 보여주던 상태에서 artifact kind와 `generatedAt` 기반 KST 시각, 비교 상태를 함께 표시하도록 개선했습니다.

## 구현 금지 사항

- artifact 페이로드를 검증 없이 신뢰하지 않습니다. `isPayload` 가드를 항상 통과해야 합니다.
- 새 artifact kind를 추가할 때 `types.ts` 타입·`artifact-workspace-registry.ts` 스키마 엔트리·`ArtifactRendererHost` switch 세 곳을 모두 갱신합니다.
- `allowsDatabaseWritesByDefault`를 전체 kind에 일괄 true로 변경하지 않습니다. per-kind 활성화만 허용합니다.
- artifact 렌더러 컴포넌트에 비즈니스 로직(LLM 호출, fetch)을 두지 않습니다. 렌더러는 props로 받은 구조체를 표시하는 역할만 합니다.

---

## 관련 파일

| 역할 | 경로 |
|------|------|
| 타입 계약 | `src/lib/ai/chat-artifacts/types.ts` |
| Intent 분류기 | `src/lib/ai/chat-artifacts/chat-artifact-intent.ts` |
| 스키마 레지스트리 | `src/lib/ai/chat-artifacts/artifact-workspace-registry.ts` |
| 실행 헬퍼 | `src/lib/ai/chat-artifacts/artifact-execution.ts` |
| 렌더러 호스트 | `src/components/ai/domain-renderers/ArtifactRendererHost.tsx` |
| 워크스페이스 패널 | `src/components/ai/artifact-workspace/ArtifactWorkspacePanel.tsx` |

## 상세 문서

- [AI Agent 설계 경계](./README.md#ai-agent-설계-경계)
- [프론트엔드 경험 설계](05-ui-design.md)
- [Runtime Architecture](../architecture/02-runtime-architecture.md)
