# AI 사이드바 & 워크스페이스 개선 계획서

> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: refactor,ai-sidebar,accessibility,duplication,ux-bug

---

## 배경 및 분석 범위

2026-05-16 AI 사이드바·워크스페이스 컴포넌트를 전문가 관점에서 분석한 결과, **실현 가능한 개선 5건**과 **오해였던 문제 2건**을 확인했다. 각 항목의 현재 상태, 무료 티어 영향, 구현 복잡도를 사전 검증한 뒤 작업 범위를 확정했다.

분석 대상:
- `src/components/ai-sidebar/AISidebarV4.tsx` (446줄)
- `src/components/ai-sidebar/ChatInputArea.tsx` (546줄)
- `src/components/ai-sidebar/EnhancedAIChat.tsx` (441줄)
- `src/components/ai-sidebar/SidebarMessage.tsx` (362줄)
- `src/components/ai/AIWorkspace.tsx` (469줄)
- `src/components/ai/AIWorkspaceMessage.tsx` (295줄)
- `src/components/ai/IncidentReportArtifactCard.tsx` (353줄)
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx` (453줄)
- `src/components/ai/ServerSnapshotArtifactCard.tsx` (199줄)
- `src/components/ai/OpsProcedureArtifactCard.tsx` (174줄)

---

## 사전 검증 결과 요약

### ✅ 실제 문제로 확인된 항목

| # | 항목 | 근거 | 우선순위 |
|---|------|------|---------|
| S1 | Escape 키 이벤트 전파 누락 | `ChatInputArea` popover ESC 핸들러가 동일 `document` target의 사이드바 ESC 핸들러를 막지 못해, popover 닫기가 사이드바 전체 닫힘을 유발 | High |
| S2 | `downloadBlob` 5중 복제 | artifact card 4개 + `auto-report/formatters.ts` 인라인 — 동일 Blob URL 다운로드 로직 5곳 | Medium |
| S3 | 사이드바 닫힘 상태 `aria-hidden` 누락 | `role="dialog"` 요소가 CSS로만 숨겨져 스크린리더가 오프스크린 콘텐츠에 접근 가능 | Medium |
| S4 | `EnhancedAIChat` 내부 헤더 이중 표시 | 사이드바에서 `AISidebarHeader` + `EnhancedAIChat` 헤더가 이중 노출 | Medium |
| S5 | `fileErrors` index key | `<p key={idx}>` 사용. 실제 버그 발생 가능성은 낮으나 React 키 원칙 위반 | Low |

### ❌ 재검토 후 문제 아님으로 판정된 항목

| 항목 | 판정 근거 |
|------|----------|
| `aria-labelledby="ai-sidebar-v4-title"` | `AISidebarHeader.tsx:67`의 `<h2 id="ai-sidebar-v4-title">`이 정확히 매핑. ARIA 체인 완결 |
| `SidebarMessage` vs `AIWorkspaceMessage` 유사성 | 렌더링 전략 실질적으로 다름: Sidebar = `InlineAgentStatus` + 직접 artifact card 렌더, Workspace = `ThinkingToggle` + `ArtifactRendererHost`. 별도 컴포넌트가 올바른 설계 |

---

## 무료 티어 영향 분석

모든 작업은 **코드 구조 변경만**이며 외부 인프라 변경 없음.

| 플랫폼 | 이번 작업 영향 | 판정 |
|--------|--------------|------|
| Vercel Pro | 변경 없음 | ✅ 영향 없음 |
| Cloud Run | 변경 없음 | ✅ 영향 없음 |
| Upstash Redis | 변경 없음 | ✅ 영향 없음 |
| Supabase | 변경 없음 | ✅ 영향 없음 |

---

## S1: Escape 키 이벤트 전파 누락 수정 (High)

### 현상 및 근거

두 컴포넌트가 동일한 `document`에 `keydown` 리스너를 등록한다:

```typescript
// ChatInputArea.tsx:128-133 (isPopoverOpen 상태일 때만 등록)
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault();   // 브라우저 기본 동작만 막음
    closePopover(true);   // ← 같은 document target의 sidebar listener 차단 없음
  }
};
document.addEventListener('keydown', handleEscape);

// AISidebarV4.tsx:252-258 (isOpen 상태에서 항상 등록)
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen) {
    onClose();            // ← 사이드바 전체 닫힘
  }
};
document.addEventListener('keydown', handleEscape);
```

`e.preventDefault()`는 브라우저 기본 동작(스크롤 등)만 차단한다. 또한 두 핸들러가 모두 `document`에 등록되므로, `stopPropagation()`만으로는 같은 target의 다른 listener 실행을 막는 보장이 부족하다. 팝오버가 열린 상태에서 Escape를 누르면 두 핸들러가 모두 실행되어 사이드바 전체가 닫힐 수 있다.

**재현 경로**: 사이드바 열기 → `+` 버튼으로 도구 메뉴 열기 → Escape 입력 → 팝오버와 사이드바가 동시에 닫힘

### 작업 범위

- [x] **S1-1**: `ChatInputArea.tsx:130`에 `e.stopImmediatePropagation()` 추가

```typescript
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.stopImmediatePropagation(); // 같은 document target의 sidebar ESC handler까지 차단
    e.preventDefault();
    closePopover(true);
  }
};
```

**예상 영향 파일:**
- `src/components/ai-sidebar/ChatInputArea.tsx`

**검증 결과 (2026-05-16):**
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai-sidebar/ChatInputArea.test.tsx` — 1 file / 12 tests PASS
- `npm run type-check` PASS
- `npm run lint` PASS (qa-tracker size info only)
- `npm run test:quick` PASS

---

## S2: `downloadBlob` 유틸리티 추출 (Medium)

### 현상 및 근거

동일한 Blob URL 다운로드 로직이 5곳에 복제되어 있다:

```typescript
// MonitoringAnalysisArtifactCard.tsx:22 — object params
function downloadBlob({ content, filename, type }: {...}): void { ... }

// ServerSnapshotArtifactCard.tsx:15 — positional params (동일 로직)
function downloadBlob(content: string, filename: string, type: string): void { ... }

// OpsProcedureArtifactCard.tsx:10 — positional params (동일 로직)
function downloadBlob(content: string, filename: string, type: string): void { ... }

// ServerMonitoringAnalysisArtifactCard.tsx:7 — positional params (동일 로직)
function downloadBlob(content: string, filename: string, type: string): void { ... }

// auto-report/formatters.ts:380-388 — 인라인 (동일 로직)
const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
// ... 동일한 6줄
```

`src/lib/ai/chat-artifacts/` 디렉터리에 artifact 관련 모듈 18개가 있으나 `download-utils.ts`는 없음 — 안전하게 신규 파일 생성 가능.

### 작업 범위

- [x] **S2-1**: `src/lib/ai/chat-artifacts/download-utils.ts` 신규 생성
  ```typescript
  export function downloadBlobContent(
    content: string,
    filename: string,
    mimeType: string
  ): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  ```
- [x] **S2-2**: `MonitoringAnalysisArtifactCard.tsx` — 로컬 `downloadBlob` 제거, `downloadBlobContent` import
- [x] **S2-3**: `ServerSnapshotArtifactCard.tsx` — 동일 교체
- [x] **S2-4**: `OpsProcedureArtifactCard.tsx` — 동일 교체
- [x] **S2-5**: `ServerMonitoringAnalysisArtifactCard.tsx` — 동일 교체
- [x] **S2-6**: `auto-report/formatters.ts` — 인라인 코드 → `downloadBlobContent` 호출로 교체

**범위 제한:**
- `IncidentReportArtifactCard.tsx`의 `downloadReport`는 `pages/auto-report/formatters.ts`에서 import하는 래퍼 함수이므로 이번 교체 대상에서 제외

**예상 영향 파일:**
- `src/lib/ai/chat-artifacts/download-utils.ts` (신규)
- `src/lib/ai/chat-artifacts/download-utils.test.ts` (신규)
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`
- `src/components/ai/ServerSnapshotArtifactCard.tsx`
- `src/components/ai/OpsProcedureArtifactCard.tsx`
- `src/components/ai/ServerMonitoringAnalysisArtifactCard.tsx`
- `src/components/ai/pages/auto-report/formatters.ts`

**검증 결과 (2026-05-16):**
- `npx vitest run src/lib/ai/chat-artifacts/download-utils.test.ts` — 1 file / 1 test PASS
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai/pages/auto-report/formatters.test.ts` — 1 file / 3 tests PASS
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai/ArtifactCards.test.tsx -t "monitoring|server snapshot|ops procedure"` — 1 file / 12 tests PASS, 4 skipped
- `npm run type-check` PASS
- `npm run lint` PASS (qa-tracker size info only)
- `npm run test:quick` PASS

---

## S3: 사이드바 닫힘 상태 `aria-hidden` 추가 (Medium)

### 현상 및 근거

```tsx
// AISidebarV4.tsx:381-394
<div
  role="dialog"
  aria-labelledby="ai-sidebar-v4-title"
  aria-modal={isOpen || undefined}   // isOpen=false 시 속성 제거
  // ← aria-hidden 없음
  className={cn(
    'gpu-sidebar-slide-in fixed z-50 ...',
    isOpen ? '' : 'gpu-sidebar-slide-out'  // CSS 애니메이션으로만 숨김
  )}
>
```

사이드바는 항상 DOM에 존재하고 CSS 클래스로만 오프스크린 처리된다. `aria-hidden`이 없으면 스크린리더가 닫힌 사이드바 콘텐츠를 읽고 Tab 포커스도 진입 가능하다. `aria-modal={isOpen || undefined}` 패턴만으로는 불충분하다.

### 작업 범위

- [x] **S3-1**: `AISidebarV4.tsx` dialog 루트 `<div>`에 `aria-hidden={!isOpen}` 추가
  ```tsx
  <div
    role="dialog"
    aria-labelledby="ai-sidebar-v4-title"
    aria-modal={isOpen || undefined}
    aria-hidden={!isOpen}   // 추가
    ...
  >
  ```

**예상 영향 파일:**
- `src/components/ai-sidebar/AISidebarV4.tsx`

**검증 결과 (2026-05-16):**
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai-sidebar/AISidebarV4.smoke.test.tsx` — 2 files / 17 tests PASS
- `npm run type-check` PASS
- `npm run lint` PASS (qa-tracker size info only)
- `npm run test:quick` PASS

---

## S4: `EnhancedAIChat` 내부 헤더 이중 표시 제거 (Medium)

### 현상 및 근거

사이드바 렌더 트리에서 두 개의 헤더가 노출된다:

```
AISidebarV4
├── AISidebarHeader        ← "AI 어시스턴트" (Brain 아이콘, 보라 그라디언트)
└── EnhancedAIChat
    ├── <div> 내부 헤더    ← "AI Chat" (Bot 아이콘, 흰 배경) ← 중복
    └── ChatMessageList / ChatInputArea
```

워크스페이스(`AIWorkspace`)에서는 `AIWorkspaceFullscreenHeader`가 내비게이션 역할만 하고 `EnhancedAIChat` 내부 헤더가 채팅 섹션 제목 역할을 해서 **유용하다**. 사이드바에서만 불필요하다.

**검증 완료:**
- `EnhancedAIChat` render site: `AISidebarV4.tsx:309`, `AIWorkspace.tsx:327` — 정확히 2곳만 사용
- 내부 헤더는 `EnhancedAIChat.tsx:209-222`에 집중되어 있음

### 작업 범위

- [x] **S4-1**: `EnhancedAIChatProps`에 `showInternalHeader?: boolean` 추가 (기본값 `true`)
- [x] **S4-2**: `EnhancedAIChat.tsx:209-222` 헤더 블록을 `{showInternalHeader && (...)}` 로 감싸기
- [x] **S4-3**: `AISidebarV4.tsx:309`의 `<EnhancedAIChat>` 호출에 `showInternalHeader={false}` 전달
- [x] **S4-4**: `AIWorkspace.tsx:327` — 변경 불필요 (기본값 `true` 유지)

**예상 영향 파일:**
- `src/components/ai-sidebar/EnhancedAIChat.tsx`
- `src/components/ai-sidebar/AISidebarV4.tsx`

**검증 결과 (2026-05-16):**
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai-sidebar/EnhancedAIChat.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx` — 2 files / 18 tests PASS
- `npm run type-check` PASS
- `npm run lint` PASS (qa-tracker size info only)
- `npm run test:quick` PASS
- `npm run line-guard` PASS (35 warning file(s), no fail-threshold violations)
- `npm run docs:budget` PASS
- `npm run docs:ai-consistency` PASS
- `git diff --check` PASS

---

## S5: `fileErrors` 복합 key 적용 (Low)

### 현상 및 근거

```tsx
// ChatInputArea.tsx:190-192
{fileErrors.map((err, idx) => (
  <p key={idx} className="text-xs text-red-600">
```

`fileErrors` 배열은 동일 메시지가 중복으로 추가될 수 있다 (예: 한 번에 여러 파일을 추가할 때 "최대 3개 파일만 첨부할 수 있습니다" 메시지가 파일 수만큼 생성). 따라서 `err.message`만으로는 유니크 키 보장이 안 된다.

`setErrors`는 `[...prev, ...newErrors]` 방식으로 batch 추가하고 `setErrors([])` 로 전체 제거만 한다 — 개별 제거가 없어 index key의 재정렬 버그는 발생하지 않는다. 다만 React 키 원칙 위반이므로 복합 키로 명확화.

### 작업 범위

- [ ] **S5-1**: `key={idx}` → `key={`${idx}-${err.message}`}` 복합 키로 교체

**예상 영향 파일:**
- `src/components/ai-sidebar/ChatInputArea.tsx`

---

## SDD 게이트

2026-05-16 Codex 검토로 S1~S4 slice를 승인하고 구현했다. S5는 같은 계획서 안의 잔여 pending task로 유지한다.

모든 항목은 "단일 버그 수정·소규모 리팩터링" 범주 — `test(spec):` 선행 커밋 없이 fix/refactor + test 동시 커밋 허용.

---

## 검증 게이트 (전체 공통)

```bash
npm run type-check
npm run lint
npm run test:quick
npm run line-guard   # 800줄 초과 파일 확인
```

---

## 작업 순서 및 의존성

```
S1 (Escape bug)  → 완료
S2 (downloadBlob) → 완료
S3 (aria-hidden)  → 완료
S4 (double header) → 완료
S5 (fileErrors key) → 독립, 최후 처리
```

S1 → S2 → S3 → S4 완료. 다음 작업은 S5.
