<!-- Owner: project -->
<!-- Status: Completed -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-05-01 -->

# Dashboard Log→Alert 역방향 크로스링크 계획

- TODO.md 연결: Active > Log→Alert 역방향 링크

> 현재 Alert→Log 단방향 연동만 존재.
> 로그 행에서 해당 서버의 알림 이력으로 이동하는 역방향 링크 추가.

---

## 0. 현황 분석

### 현재 크로스링크 현황 (단방향)

| 방향 | 구현 위치 | 동작 |
|------|----------|------|
| Alert → Log | `ActiveAlertsModal.tsx` AlertRow | `router.push('/dashboard/logs?server=X')` |
| Alert → Log | `AlertHistoryModal.tsx` AlertHistoryRow | `router.push('/dashboard/logs?server=X')` |
| **Log → Alert** | — | **미구현** |

### 문제

로그 탐색기에서 "이 서버에 알림이 있나?" 확인하려면:
1. 알림 메뉴로 수동 이동
2. 서버 필터 직접 입력

서버명을 알고 있어도 컨텍스트 전환 비용이 큼.

### 목표 UX

```
로그 행:
┌─────────────────────────────────────────────────────────────────────┐
│ [경고] storage-nfs-dc1-01  [nfsd]  NFS I/O latency 1857ms  🔔 알림  │
└─────────────────────────────────────────────────────────────────────┘
                                                           ↑
                                          클릭 → /dashboard/alerts?server=storage-nfs-dc1-01
```

```
서버 모달 로그탭 (EnhancedServerModal.LogsTab):
이미 서버 컨텍스트이므로 탭 간 이동 버튼 추가
[로그] [알림] [스트림] ← 탭 내 "이 서버 알림 이력 보기" 버튼
```

---

## 1. 계약 (Contract)

- 알림 라우트 URL 파라미터: `/dashboard/alerts?server=<serverId>` 추가 지원
- `AlertHistoryPanel`은 `initialServerId` prop으로 초기 서버 필터 수신
- 기존 `AlertHistoryPanel`의 `serverIds` prop 계약 변경 없음
- `LogExplorerModal`의 `GlobalLogEntry.serverId` 그대로 사용 (추가 API 불필요)
- 알림 이력 페이지(`/dashboard/alerts`)의 라우트 변경 없음

### 테스트 계약

```
C1: 로그 행 "🔔 알림" 버튼 클릭 시 /dashboard/alerts?server=X 로 이동
C2: /dashboard/alerts?server=X 진입 시 AlertHistoryPanel serverId 필터 초기값 적용
C3: serverId 파라미터 없으면 기존 동작 유지 (전체 서버)
C4: EnhancedServerModal LogsTab "알림 이력" 버튼 → 같은 서버 alerts 탭으로 이동
```

---

## 2. 설계

### 2-1. 알림 페이지 URL 파라미터 수신

```tsx
// src/components/dashboard/DashboardRoutedContent.tsx
// dashboard route shell에서 searchParams.server를 initialServerId로 전달

import { type ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';

export default function DashboardRoutedContent({ view }) {
  const searchParams = useSearchParams();
  const initialServer = searchParams.get('server') ?? '';

  return (
    <AlertHistoryPanel
      serverIds={serverIds}
      initialServerId={initialServer}  // 신규 prop
    />
  );
}
```

### 2-2. AlertHistoryPanel initialServerId prop 추가

```tsx
// src/components/dashboard/alert-history/AlertHistoryModal.tsx

export function AlertHistoryPanel({
  active = true,
  serverIds,
  onAskAIAboutAlert,
  initialServerId = '',    // 신규 prop
}: Omit<AlertHistoryModalProps, 'open' | 'onClose'> & {
  active?: boolean;
  initialServerId?: string;
}) {
  // useState 초기값에 적용
  const [serverId, setServerId] = useState(initialServerId);

  // URL param이 바뀌면 반영 (직접 URL 접근 시)
  useEffect(() => {
    if (initialServerId) setServerId(initialServerId);
  }, [initialServerId]);
```

### 2-3. LogExplorerModal 로그 행에 알림 링크 버튼 추가

```tsx
// src/components/dashboard/log-explorer/LogExplorerModal.tsx
// 로그 행 우측에 Bell 아이콘 + "알림" 버튼 추가

import { Bell, FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 로그 행 내부
const router = useRouter();

// 기존 서버 배지 옆에 추가
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    router.push(`/dashboard/alerts?server=${encodeURIComponent(log.serverId)}`);
  }}
  aria-label={`${log.serverId} 알림 이력 보기`}
  title="알림 이력"
  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-amber-600 hover:bg-amber-50 transition-colors"
>
  <Bell size={10} />
  알림
</button>
```

### 2-4. AlertHistoryModalProps 타입 확장

```ts
// src/components/dashboard/alert-history/alert-history.types.ts

export interface AlertHistoryModalProps {
  open: boolean;
  onClose: () => void;
  serverIds: string[];
  onAskAIAboutAlert?: (alert: Alert) => void;
  initialServerId?: string;   // 신규
}
```

### 2-5. AlertHistoryPanel serverId 드롭다운 연동 확인

`initialServerId`가 전달되면 `<select value={serverId}>` 가 해당 서버로 자동 선택됨.
`serverIds` 배열에 해당 id가 없으면 빈 값으로 fallback (오류 없음).

---

## 3. Task 목록

### Phase 1 — URL 파라미터 + prop 확장 (P0, ~0.5일)

- [x] **C1**: `alert-history.types.ts` — `initialServerId?: string` 추가
- [x] **C2**: `AlertHistoryPanel` — `initialServerId` prop 수신 + `useState` 초기값 적용
- [x] **C3**: `DashboardRoutedContent.tsx` — `searchParams.get('server')` → `initialServerId` 전달
- [x] **C4**: 단위 테스트: initialServerId prop 적용 확인

### Phase 2 — 로그 행 알림 링크 (P0, ~0.5일)

- [x] **C5**: `LogExplorerModal.tsx` 로그 행에 Bell 아이콘 + "알림" 버튼 추가
- [x] **C6**: 그룹 대표 행(representative)과 상세 펼침 행 모두 적용
- [x] **C7**: `LogExplorerModal.test.tsx` — 알림 버튼 렌더 및 클릭 테스트

### Phase 3 — 브라우저 검증 (P0, ~0.5일)

- [x] **C8**: 로그 페이지 → "알림" 버튼 클릭 → 알림 페이지 서버 필터 자동 적용 확인
- [x] **C9**: URL 직접 접근 `/dashboard/alerts?server=api-was-dc1-01` 동작 확인
- [x] **C10**: `server` 파라미터 없는 기존 접근 `/dashboard/alerts` 회귀 없음 확인

### 추가 완료

- [x] **계약 C4**: `EnhancedServerModal.LogsTab` — 서버 상세 로그 탭 "알림 이력" 버튼 추가 및 같은 서버 필터로 이동
- [x] `serverId` query alias, no-param fallback, URL encoding edge 테스트 보강

---

## 4. 변경 금지 범위

- `src/hooks/dashboard/useAlertHistory.ts` — 데이터 계약 변경 없음
- `src/app/dashboard/alerts/page.tsx` 라우트 경로 변경 없음
- 기존 Alert→Log 링크 동작 변경 없음 (`/dashboard/logs?server=X`)

---

## 5. 참조

- 알림 페이지: `src/app/dashboard/alerts/page.tsx`
- AlertHistoryPanel: `src/components/dashboard/alert-history/AlertHistoryModal.tsx`
- AlertHistoryModalProps: `src/components/dashboard/alert-history/alert-history.types.ts`
- LogExplorerModal: `src/components/dashboard/log-explorer/LogExplorerModal.tsx`
- 기존 Alert→Log 패턴 참조: `AlertHistoryModal.tsx` AlertHistoryRow `handleOpenLogs`

---

## 6. 완료 검증

- Targeted tests: `AlertHistoryModal.test.tsx`, `LogExplorerModal.test.tsx`, `DashboardRoutedContent.test.tsx`, `EnhancedServerModal.LogsTab.test.tsx` — 23/23 pass
- Root gates: `npm run type-check`, `npm run lint`, `npm run test:quick`, `git diff --check` pass
- Browser QA:
  - `/dashboard/logs?server=api-was-dc1-01` 진입 시 로그 서버 필터 `api-was-dc1-01`, 알림 버튼 50개 렌더
  - 로그 행 "알림" 클릭 시 `/dashboard/alerts?server=api-was-dc1-01`, 알림 서버 필터 자동 선택
  - `/dashboard/alerts?server=api-was-dc1-01` 직접 접근 정상
  - `/dashboard/alerts` 무파라미터 접근 정상, 서버 필터 전체 서버 유지
  - `/dashboard/servers/api-was-dc1-01` > 로그 & 네트워크 > "알림 이력" 클릭 시 동일 서버 알림 이력으로 이동
