# Developer Panel — 구현 계획서

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-07
> Canonical: reports/planning/developer-panel-plan.md
> Tags: ai,developer-mode,diagnostics,ui

---

## 배경 및 목적

현재 `internalDisclosureMode='developer'`는 **백엔드 전용 개념**이다.
- Vercel side: `internal-disclosure-mode.ts` → auth 컨텍스트로 developer 모드 판정
- Cloud Run side: `internal-disclosure-policy.ts` → AI가 내부 경로/구현 정보를 더 공개함

개발 중 필요한 진단 정보(AI provider, 모델, 핸드오프, RAG 히트, 스트림 메타데이터 등)는 현재 콘솔/Langfuse 에서만 확인 가능하다. **UI에 Developer Panel을 추가**하여 개발자가 코드 없이 실시간 진단할 수 있게 한다.

**비개발자 사용자에게는 일절 노출되지 않는다.**

---

## 범위

### In Scope
- AI 사이드바 안에 토글 가능한 Developer Panel (overlay 방식, 별도 라우트 아님)
- 기존 `internalDisclosureMode` gate 재사용 — 신규 auth 로직 없음
- 스트림 응답 메타데이터 시각화 (이미 `useDeferredMessageMetadata`로 수집 중)
- 시스템 진단 섹션 (Cloud Run 상태, 환경 정보)

### Out of Scope
- 별도 `/dev` 라우트 생성
- 관리자 권한 분리 (admin vs developer)
- 프로덕션 번들 트리셰이크 (현재 `process.env.NODE_ENV` 조건으로 충분)
- 실시간 로그 스트리밍 (Langfuse 위임)

---

## 설계 결정

### Gate: 기존 disclosure mode 그대로 재사용

```
authContext.authType ∈ {development, test, test-secret}
  또는 verified PIN guest(authType='guest' + server-issued userId)
    → internalDisclosureMode = 'developer'
    → Developer Panel 표시
```

프론트엔드에서 `isDeveloperDisclosureMode` flag를 API 응답 헤더 또는 초기 세션 상태로 전달받는다.

### 진입점: AI 사이드바 내 토글 버튼

```
AI Sidebar
  └─ [⚙] 개발자 패널 토글 (developer 모드에서만 렌더)
       └─ DeveloperPanel (collapsible overlay)
            ├─ AI Session Info
            ├─ Stream Metadata
            ├─ System Status
            └─ Knowledge Base Stats
```

컴포넌트 파일 경계:
- `src/components/ai-sidebar/DeveloperPanel.tsx` — UI 전체
- `src/hooks/ai/useDeveloperPanel.ts` — 데이터 수집/포맷

---

## 계약 (Contract)

### API 계약: developer mode flag 전달

현재 `internalDisclosureMode`는 Cloud Run 요청 body에만 존재한다.
프론트엔드가 "이 세션이 developer 모드인지" 알 방법이 없다.

**해결**: Vercel `/api/ai/supervisor` 응답에 헤더 추가

```
X-Developer-Mode: true   (developer 모드일 때만)
```

또는 stream data event에 `type: 'developer-context'` 추가:
```json
{ "type": "developer-context", "mode": "developer" }
```

→ **stream data event 방식 채택** (기존 SSE 파이프라인에 자연스럽게 통합)

### 컴포넌트 계약

```typescript
// useDeveloperPanel.ts
type DeveloperPanelData = {
  sessionMode: 'developer' | null;
  aiSession: {
    provider: string;
    modelId: string;
    handoffCount: number;
    durationMs: number;
    toolsCalled: string[];
  } | null;
  streamMeta: {
    analysisBasis: string;
    stepsExecuted: number;
    tokensUsed?: number;
  } | null;
  systemStatus: {
    cloudRunHealthy: boolean;
    cloudRunUrl: string;
  } | null;
  knowledgeBase: {
    ragType: string;
    hitCount: number;
    graphHits: number;
    vectorHits: number;
  } | null;
};
```

### 테스트 시나리오

```
1. developer 모드 세션에서 AI 사이드바 → 패널 토글 버튼 표시됨
2. user 모드 세션(일반 게스트)에서 → 토글 버튼 렌더되지 않음
3. AI 응답 완료 후 → AI Session / Stream Metadata 섹션에 실제 값 표시
4. Cloud Run 오프라인 시 → systemStatus.cloudRunHealthy=false 표시
5. 패널 닫기 → 상태 유지, 다음 응답 후 갱신
```

---

## 구현 태스크

### Phase 1: Gate + 데이터 파이프라인 (백엔드)

- [ ] `T1` `src/app/api/ai/supervisor/stream/v2/route.ts`: `developer-context` stream data event 추가
  - `internalDisclosureMode='developer'`일 때 스트림 첫 chunk에 emit
- [ ] `T2` `src/hooks/ai/utils/stream-data-handler.ts`: `developer-context` event 파싱 추가
- [ ] `T3` `src/hooks/ai/useDeveloperPanel.ts`: 신규 훅 작성
  - stream metadata, AI session info, system status 수집

### Phase 2: UI 컴포넌트 (프론트엔드)

- [ ] `T4` `src/components/ai-sidebar/DeveloperPanel.tsx`: 패널 UI 구현
  - 4개 섹션: AI Session / Stream Metadata / System Status / Knowledge Base
  - Tailwind + 기존 `cn()` 유틸, 공용 `Card` 컴포넌트 재사용
- [ ] `T5` AI 사이드바 통합: developer 모드 조건부 토글 버튼 추가
  - 수정 파일: `src/components/ai-sidebar/AISidebarV4.tsx`

### Phase 3: 테스트

- [ ] `T6` `DeveloperPanel.test.tsx` — developer/user 모드 렌더 분기 테스트
- [ ] `T7` `stream-data-handler.test.ts` — `developer-context` event 파싱 케이스 추가

---

## 검증 기준

- [ ] developer 모드에서 패널 표시, user 모드에서 미표시
- [ ] AI 응답 후 provider/modelId/handoffCount 실제 값 표시
- [ ] `npm run test:quick` 통과
- [ ] `npm run type-check` 통과
- [ ] Playwright smoke (`npm run test:e2e:critical`) 회귀 없음

---

## 참조

- 기존 gate: `src/app/api/ai/supervisor/internal-disclosure-mode.ts`
- AI Engine policy: `cloud-run/ai-engine/src/services/ai-sdk/internal-disclosure-policy.ts`
- 메타데이터 훅: `src/hooks/ai/useDeferredMessageMetadata.ts`
- 스트림 핸들러: `src/hooks/ai/utils/stream-data-handler.ts`
