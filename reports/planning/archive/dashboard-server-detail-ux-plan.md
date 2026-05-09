# Dashboard 서버 카드 & 상세 페이지 UX 개선 계획

> Owner: project
> Status: Implemented
> Doc type: How-to
> Last reviewed: 2026-05-08
> Tags: dashboard,ux,server-card,server-detail,dead-code

---

> Follow-up note (2026-05-09): 이 계획서는 완료 당시의 구현 이력을 보존한다. 이후 제품 포지션이 "core 서버 모니터링 제품 + 별도 AI Assistant 모듈"로 재정렬되면서, 상세 페이지/카드/알림 행의 per-entity AI CTA는 [Dashboard AI Surface Boundary Plan](dashboard-ai-surface-boundary-plan.md)에서 제거 또는 AI surface 이동 대상으로 재분류됐다.

---

## 배경 및 목적

현재 `ServerDashboard`는 카드 클릭 시 `router.push('/dashboard/servers/[serverId]')`로 페이지 이동하며,
`ServerDetailView`가 실제 상세 페이지로 동작하고 있다.

**문제점:**
1. `EnhancedServerModal.tsx` (490줄)가 어디서도 호출되지 않는 dead code로 방치됨
2. `ServerDetailView` 헤더에 서버 상태 색상 신호가 없음 (카드와 시각적 연속성 없음)
3. Overview 탭에 CPU/Mem/Disk 수치가 두 번 표시됨 (OverviewTab 내부 + 아래 별도 그리드)
4. 상세 페이지에서 AI에게 바로 질문할 수 없음
5. 서버 카드 Progressive Disclosure가 호버(2차)→클릭(3차) 두 단계로 나뉘어 동작 예측 어려움

---

## 계약 (Contract)

### 변경 범위

| 항목 | 파일 | 변경 유형 |
|------|------|----------|
| Modal 셸 제거 | `EnhancedServerModal.tsx` | 삭제 |
| 상세 페이지 헤더 | `ServerDetailView.tsx` | 수정 |
| 중복 메트릭 섹션 제거 | `ServerDetailView.tsx` | 수정 |
| AI Ask 버튼 추가 | `ServerDetailView.tsx` | 수정 |
| 카드 Progressive Disclosure 단순화 | `ImprovedServerCard.tsx` | 수정 |

### 삭제 불가 파일 (공유 컴포넌트)

아래 파일들은 `EnhancedServerModal.*` 네임스페이스이지만 `ServerDetailView`가 사용 중이므로 유지:

- `EnhancedServerModal.LogsTab.tsx` + `.parts.tsx`
- `EnhancedServerModal.MetricsTab.tsx`
- `EnhancedServerModal.NetworkTab.tsx`
- `EnhancedServerModal.OverviewTab.tsx`
- `EnhancedServerModal.ProcessesTab.tsx`
- `EnhancedServerModal.components.tsx`
- `EnhancedServerModal.metrics.helpers.ts` + `.constants.ts`
- `EnhancedServerModal.types.ts`
- `EnhancedServerModal.utils.ts`

### Pass 기준

| 검증 포인트 | 기준 |
|------------|------|
| Modal 제거 후 빌드 | `npm run type-check` 에러 0건 |
| 서버 상세 페이지 | 헤더에 상태 색상 배지(critical=red, warning=amber, online=green) 표시 |
| 중복 메트릭 제거 | Overview 탭에서 CPU/Mem/Disk 수치가 한 번만 표시됨 |
| AI Ask 버튼 | 상세 페이지 헤더에 "AI에게 물어보기" 버튼 존재, 클릭 시 AI 어시스턴트 연동 |
| 카드 Progressive Disclosure | 호버→2차 단계 없이 ▼ 버튼 클릭으로만 확장/접기 |
| 기존 테스트 | `npm run test:quick` 전체 통과 |

---

## 세부 작업 명세

### Task 1: EnhancedServerModal.tsx 삭제 + 타입 정리

**작업 내용:**
1. `src/components/dashboard/EnhancedServerModal.tsx` 파일 삭제
2. `EnhancedServerModal.types.ts`의 `EnhancedServerModalProps` 인터페이스 제거 (다른 파일에서 미사용)
3. `ServerModalHeader.tsx` — 여전히 사용 중이므로 유지
4. `dashboard-modal-theme-contract.test.tsx` — 내용 확인 후 modal 참조 제거 또는 파일 삭제
5. `EnhancedServerModal.test.tsx` — modal shell 테스트이므로 삭제

**확인:**
```bash
grep -r "EnhancedServerModal[^.]" src --include="*.tsx" --include="*.ts"
# → 결과가 shell 파일 자체 + types 인터페이스만 나와야 함
```

### Task 2: ServerDetailView 헤더 UX 개선

**현재:**
- 헤더 카드가 흰 배경 단순 텍스트
- "서버 상세" 레이블 + 서버명 텍스트
- Live/Paused 토글이 오른쪽에 단독

**목표:**
- 왼쪽 상태 컬러 배지: `online` → green chip, `warning` → amber chip, `critical` → red chip
- `ServerModalHeader` 컴포넌트를 재사용하거나 동일한 `ServerData` 기반 헤더 구성
- AI Ask 버튼: `warning/critical` 서버일 때 "AI에게 물어보기" 버튼 표시

**구현 위치:** `ServerDetailView.tsx:163~211` 헤더 섹션

**AI Ask 연동 방법:**
- `ServerDetailView` props에 `onAskAI?: (server: ServerData) => void` 추가
- `DashboardRoutedContent.tsx`의 `view === 'server-detail'` 분기에서 `onAskAIAboutAlert` 연결
- `askAIAboutServer` 핸들러 재사용 가능

### Task 3: Overview 탭 중복 메트릭 제거

**현재 구조 (`ServerDetailView.tsx:219~253`):**
```
{selectedTab === 'overview' && (
  <div>
    <OverviewTab ... />          ← 이미 게이지/수치 포함
    <div "핵심 성능 지표">       ← CPU/Mem/Disk/Services 동일 수치 반복
      {CPU, Memory, Disk, Services 그리드}
    </div>
  </div>
)}
```

**목표:** "핵심 성능 지표" 그리드 블록 제거 (223~253줄).
`OverviewTab` 내 게이지로 충분히 수치를 전달하고 있음.

> 동일 중복이 `EnhancedServerModal.tsx:314~386`에도 존재하나 Task 1 삭제로 함께 사라짐.

### Task 4: 서버 카드 Progressive Disclosure 단순화

**현재 동작 (`ImprovedServerCard.tsx:253~262`):**
- `onMouseEnter` → `setShowSecondaryInfo(true)` (호버로 2차 정보 자동 노출)
- ChevronDown 버튼 클릭 → `showTertiaryInfo` 토글, `true`이면 `showSecondaryInfo`도 강제 `true`

**목표:**
- `onMouseEnter`/`onMouseLeave`의 `setShowSecondaryInfo` 호출 제거
- ChevronDown 클릭으로만 전체 확장/접기 동작
- `showSecondaryInfo` state 제거 → `showTertiaryInfo` 하나로 통합

**주의:** `SecondaryMetrics`, `ServiceChip` 등 `showSecondaryInfo`를 읽는 하위 컴포넌트 확인 필요.

---

## Task 목록

- [x] **Task 1**: `EnhancedServerModal.tsx` 삭제 + `EnhancedServerModal.test.tsx` 삭제 + 타입 정리 + `type-check` 통과
- [x] **Task 2**: `ServerDetailView` 헤더 — 상태 컬러 배지 + AI Ask 버튼 추가 + `DashboardRoutedContent` 연결
- [x] **Task 3**: Overview 탭 "핵심 성능 지표" 중복 그리드 제거
- [x] **Task 4**: `ImprovedServerCard` Progressive Disclosure 단계 통합 (호버 자동 노출 제거)
- [x] **Task 5**: `npm run test:quick` + `npm run type-check` 전체 통과 확인
- [x] **Task 6**: Playwright MCP로 `/dashboard/servers` → 카드 클릭 → 상세 페이지 플로우 시각 확인

---

## 검증 결과

- QA 기록: `QA-20260509-0427`
- `npm run type-check`: pass
- `npm run lint`: pass (`qa-tracker.json` size info only)
- `npm run test:quick`: pass
- Targeted Vitest: `ServerDetailView.test.tsx`, `ImprovedServerCard.test.tsx` pass
- Playwright targeted flow: `/dashboard/servers` 카드 클릭 → 상세 route 이동, 탭 전환, 모바일 overflow guard pass. 첫 cold run에서 route-click 1회 timeout 후 동일 케이스 재실행 pass.
- `npm run docs:components:verify`: pass
- `git diff --check`: pass

---

## 예상 결과 및 리스크

| 리스크 | 가능성 | 영향 | 대응 |
|--------|--------|------|------|
| `EnhancedServerModal.test.tsx` 외 다른 테스트가 modal import | 낮음 | 빌드 실패 | Task 1 전 grep으로 사전 확인 |
| `showSecondaryInfo` 제거 시 숨겨진 UI 누락 | 중간 | 일부 정보 미노출 | Task 4 전 SecondaryMetrics 렌더 조건 전수 확인 |
| AI Ask 연동 시 onAskAI prop 체인 | 낮음 | 버튼 동작 안 함 | DashboardRoutedContent → ServerDetailView 연결 확인 |

---

_Last Updated: 2026-05-08_
