# Developer Panel — 구현 계획서

> Owner: project
> Status: Implemented
> Doc type: Plan
> Last reviewed: 2026-05-08
> Canonical: reports/planning/developer-panel-plan.md
> Tags: ai,developer-mode,diagnostics,ai-context

---

## 배경 및 목적

Developer Panel은 **AI 에이전트(Claude, Codex 등)가 세션 진단 정보를 읽기 위한 인터페이스**다.
사람이 직접 보는 경우는 드물다. AI가 MCP 브라우저 도구(`take_snapshot`, `evaluate_script`)로
DOM을 조회하거나, API를 직접 호출해 JSON을 읽는 방식으로 소비한다.

따라서 설계 우선순위는:
1. AI가 파싱하기 쉬운 구조화된 출력 (JSON, `data-*` 속성)
2. 추가 인터랙션 없이 한 번에 읽히는 구조 (토글/애니메이션 없음)
3. 인간 UI 품질(색상, 레이아웃, 애니메이션)은 비우선

---

## 범위

### In Scope

- `data-testid="developer-panel"` 마운트 포인트 — developer 모드에서만 렌더
- 기존 `internalDisclosureMode` gate 재사용 — 신규 auth 로직 없음
- 세션 진단 데이터를 `data-panel-json` 속성 또는 `<script type="application/json">` 인라인 블록으로 노출
- MCP `take_snapshot` / `evaluate_script`로 읽을 수 있는 구조

### Out of Scope

- 시각적 Card UI, 토글 버튼, 애니메이션, 색상 테마 — AI는 스타일을 읽지 않음
- 별도 `/dev` 라우트
- 관리자 권한 분리
- 실시간 로그 스트리밍

---

## 설계 결정

### Gate: 기존 disclosure mode 재사용

```
authContext.authType ∈ {development, test, test-secret}
  또는 verified PIN guest(authType='guest' + server-issued userId)
    → internalDisclosureMode = 'developer'
    → Developer Panel 렌더
```

### 출력 형식: JSON-in-DOM

```html
<!-- developer 모드에서만 렌더됨 -->
<div
  data-testid="developer-panel"
  data-panel-json='{"session":{"provider":"groq","modelId":"llama-3.3-70b","handoffCount":2},...}'
  hidden
/>
```

- `hidden` 속성: DOM에는 존재하지만 화면에 표시되지 않음
- AI는 `evaluate_script('document.querySelector("[data-testid=developer-panel]")?.dataset.panelJson')` 로 직접 읽음
- 또는 Playwright `locator('[data-testid=developer-panel]').getAttribute('data-panel-json')`

### 데이터 갱신: 응답 완료 시 1회 업데이트

AI가 응답 완료 후 패널을 읽는 시나리오가 메인이므로, 스트리밍 중 실시간 갱신은 불필요.
`onFinish` 콜백 시점에 `data-panel-json`을 최신 메타데이터로 교체.

---

## 계약 (Contract)

### 패널 JSON 스키마

```typescript
type DeveloperPanelData = {
  ts: string;                  // ISO timestamp, 마지막 갱신
  session: {
    provider: string;          // 실제 사용된 LLM provider
    modelId: string;
    handoffCount: number;
    durationMs: number;
    toolsCalled: string[];
  } | null;
  stream: {
    analysisBasis: string;     // 'multi-agent' | 'single-agent' | 'fallback'
    stepsExecuted: number;
    tokensUsed?: number;
  } | null;
  system: {
    cloudRunHealthy: boolean;
    cloudRunUrl: string;
    disclosureMode: string;
  } | null;
  rag: {
    ragType: string;
    hitCount: number;
    graphHits: number;
    vectorHits: number;
  } | null;
};
```

### developer-context stream event

스트림에서 `developer-context` event를 수신하면 패널 데이터를 갱신한다.

```json
{ "type": "developer-context", "mode": "developer", "meta": { ... } }
```

### 테스트 시나리오

```
1. developer 모드: DOM에 data-testid="developer-panel" 노출 (hidden)
2. user 모드: 패널 요소 렌더되지 않음
3. AI 응답 완료 후: data-panel-json에 실제 provider/modelId/handoffCount 포함
4. Cloud Run 오프라인: system.cloudRunHealthy=false 포함
5. evaluate_script로 panelJson 파싱: JSON.parse 성공, 스키마 필드 존재 확인
```

---

## 구현 태스크

### Phase 1: 백엔드 — developer-context event

- [x] `T1` `src/app/api/ai/supervisor/stream/v2/route.ts`
  - `internalDisclosureMode='developer'`일 때 스트림 첫 chunk에 `developer-context` event emit
- [x] `T2` `src/hooks/ai/utils/stream-data-handler.ts`
  - `developer-context` event 파싱 + store에 저장
- [x] `T3` `src/hooks/ai/useDeveloperPanel.ts`
  - stream metadata, AI session info, system status를 `DeveloperPanelData`로 조합
  - `onFinish` 시점에 DOM `data-panel-json` 갱신

### Phase 2: DOM 마운트

- [x] `T4` `src/components/ai-sidebar/DeveloperPanel.tsx`
  - `<div data-testid="developer-panel" data-panel-json={...} hidden />`
  - 스타일 없음, 단순 마운트
- [x] `T5` AI 사이드바 통합
  - `src/components/ai-sidebar/AISidebarV4.tsx` — developer 모드 조건부 렌더

### Phase 3: 테스트

- [x] `T6` `DeveloperPanel.test.tsx`
  - developer/user 모드 렌더 분기
  - `data-panel-json` 파싱 가능 여부
- [x] `T7` `stream-data-handler.test.ts`
  - `developer-context` event 파싱 케이스 추가

---

## AI 읽기 워크플로우 (예시)

```javascript
// Claude/Codex가 MCP evaluate_script로 직접 읽는 방법
const raw = document.querySelector('[data-testid="developer-panel"]')?.dataset?.panelJson;
const panel = raw ? JSON.parse(raw) : null;
// → { session: { provider: 'groq', modelId: '...', handoffCount: 2 }, ... }
```

또는 Playwright:
```javascript
const json = await page.locator('[data-testid="developer-panel"]').getAttribute('data-panel-json');
const panel = JSON.parse(json);
```

---

## 검증 기준

- [x] developer 모드에서 `data-testid="developer-panel"` 요소 존재
- [x] `data-panel-json` JSON.parse 성공 + 스키마 필드 존재
- [x] user 모드에서 패널 요소 없음
- [x] `npm run test:quick` 통과
- [x] `npm run type-check` 통과

## 구현 결과

- SDD 순서 준수:
  - `b70fcf547` `test(spec): developer panel add failing tests before implementation`
  - 구현 커밋 예정: failing specs 통과 후 plan 완료 처리
- Vercel stream proxy는 `internalDisclosureMode='developer'`일 때 첫 SSE data part로 `data-developer-context`를 prepend한다.
- 클라이언트 stream handler는 `data-developer-context`를 `DeveloperPanelData`로 정규화하고, 후속 `data-done` 메타데이터(provider/model/tools/retrieval)를 병합한다.
- `AISidebarV4`는 panel data가 존재할 때만 hidden DOM mount를 렌더한다. 일반 user mode에서는 요소가 없다.

## 검증 결과

- `node scripts/dev/vitest-node-wrapper.js run src/app/api/ai/supervisor/stream/v2/route.test.ts` — pass (`32/32`)
- `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts src/hooks/ai/utils/stream-data-handler.test.ts src/components/ai-sidebar/DeveloperPanel.test.tsx` — pass (`29/29`)
- `npm run type-check` — pass
- `npm run lint` — pass (`reports/qa/qa-tracker.json` size info only)
- `npm run test:quick` — pass
- `npm run test:contract` — pass (`20/20`)

---

## 참조

- 기존 gate: `src/app/api/ai/supervisor/internal-disclosure-mode.ts`
- AI Engine policy: `cloud-run/ai-engine/src/services/ai-sdk/internal-disclosure-policy.ts`
- 메타데이터 훅: `src/hooks/ai/useDeferredMessageMetadata.ts`
- 스트림 핸들러: `src/hooks/ai/utils/stream-data-handler.ts`
