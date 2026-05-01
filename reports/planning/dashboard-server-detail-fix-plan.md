<!-- Owner: project -->
<!-- Status: Completed -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-05-01 -->

# Dashboard 서버 상세 페이지 버그 수정 계획

- TODO.md 연결: Active > 서버 상세 페이지 2가지 버그 수정

> **문제 1**: `EnhancedServerModal.LogsTab.parts.tsx` — LegacyLogView/StreamsView dark 배경 잔재
> **문제 2**: `ServerDetailView` — 서버 타입 "unknown" 표시 버그

---

## 0. 현황 분석

### 문제 1: Dark 배경 잔재 (`LogsTab.parts.tsx`)

서버 상세 페이지의 "로그 & 네트워크" 탭은 `LogsTab` → `EnhancedServerModal.LogsTab.parts.tsx`를 사용한다.
`LogExplorerModal.tsx`는 이미 white로 전환됐지만 이 파일은 별도 컴포넌트.

| 위치 | 현재 코드 | 문제 |
|------|----------|------|
| `LegacyLogView` line 114 | `bg-linear-to-br from-gray-900 via-gray-800 to-black` | dark 배경 |
| `LegacyLogView` line 166 | `bg-linear-to-t from-gray-900 to-transparent` | dark fade overlay |
| `StreamsView` line 239 | `bg-linear-to-br from-gray-900 via-gray-800 to-black` | dark 배경 |
| `StreamsView` line 298 | `bg-linear-to-t from-gray-900 to-transparent` | dark fade overlay |
| `getLogLevelStyles` | `textClass: 'text-red-300'` 등 | dark 배경 전용 밝은 텍스트 |
| `StreamsView` line 253 | `bg-white/5 hover:bg-white/10` | dark 전제 스트림 헤더 |
| `StreamsView` line 255–266 | `text-gray-400`, `text-blue-400`, `text-gray-500` | dark 대비 색상 |
| `StreamsView` EmptyState line 291–296 | "No matching streams" / "Adjust label filters..." | 영어 미번역 |
| `LegacyLogView` line 113 | `border-slate-700/60` | dark 계열 테두리 |
| `LegacyLogView` line 138 | `text-gray-400` | dark 배경 전용 타임스탬프 색상 |

### 문제 2: 서버 타입 "unknown" 표시 (`ServerDetailView`)

원인 추적:
- OTel resource catalog: `api-was-dc1-01['server.role'] = "application"`
- `otel-direct-transform.ts`: `type: resource?.['server.role'] ?? 'unknown'`
- `server-data.ts`: `type: em.type as ServerRole`
- `normalizeServerData`: `type: server.type || 'unknown'`

실제 값은 `"application"` 이어야 하지만, 서버 상세 페이지(`/dashboard/servers/:id`)에서
URL 파라미터로 서버를 찾을 때 `allServers` 또는 `servers` 배열에서 매칭되지 않으면
`server = null`이 되고, `safeServer`도 `null`이 돼서 빈 페이지가 나와야 한다.

실제로 `safeServer`가 존재하면서 `type`이 "unknown"으로 나오는 경우는:
- `server.type`이 `undefined` 또는 `""` 인 경우
- `server.type`이 실제로 `"unknown"` 인 경우 (otel 로더에서 catalog miss)

**핵심 수정**: `normalizeServerData`에 이름 기반 타입 추론 fallback 추가

```
api-was-* → "application"
web-nginx-* → "web"
db-mysql-* / db-redis-* → "database" / "cache"
storage-nfs-* → "storage"
lb-haproxy-* → "load-balancer"
```

추가: `ServerDetailView` 헤더에서 `safeServer.type`을 그대로 표시하지 않고,
사람이 읽기 편한 레이블로 변환하는 `formatServerType` 헬퍼 사용.

---

## 1. 계약 (Contract)

- 기존 `getLogLevelStyles` 반환 구조 유지 (`containerClass`, `badgeClass`, `textClass`)
- `normalizeServerData` 반환 타입 변경 없음
- `ServerDetailView` 컴포넌트 props 변경 없음
- `LogsTab`의 부모 컴포넌트 변경 없음

### 테스트 계약

```
D1: LegacyLogView 렌더 시 dark 계열 배경 클래스 미존재
D2: StreamsView 렌더 시 dark 계열 배경 클래스 미존재
D3: getLogLevelStyles 'error' → textClass에 dark 계열 색상 미포함
D4: normalizeServerData server.type='application' → type='application'
D5: normalizeServerData server.type=undefined, id='api-was-dc1-01' → type≠'unknown'
D6: normalizeServerData server.type=undefined, id='web-nginx-dc1-01' → type='web'
D7: ServerDetailView 헤더에 서버 역할 레이블 표시 (영어 원형 허용)
```

---

## 2. 설계

### 2-1. `getLogLevelStyles` — textClass dark → light

```ts
// 변경 전
case 'error': return { ..., textClass: 'text-red-300' };
case 'warn':  return { ..., textClass: 'text-yellow-300' };
default:      return { ..., textClass: 'text-green-300' };

// 변경 후
case 'error': return { ..., textClass: 'text-red-700' };
case 'warn':  return { ..., textClass: 'text-amber-700' };
default:      return { ..., textClass: 'text-green-700' };
```

### 2-2. `LegacyLogView` — dark 배경 white 전환

```tsx
// 변경 전
<div className="relative overflow-hidden rounded-2xl border border-slate-700/60 shadow-lg">
  <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-800 to-black" />
  <div className="relative h-[55vh] ... font-mono text-sm ...">
    ...
    <span className="text-xs text-gray-400">{formatTimestamp(...)}</span>
    <span className="text-xs font-semibold text-blue-400">[{log.source}]</span>
  </div>
  <div className="... bg-linear-to-t from-gray-900 to-transparent" />
</div>

// 변경 후
<div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
  <div className="h-[55vh] min-h-[320px] max-h-[500px] overflow-y-auto bg-white p-4 font-mono text-sm sm:p-6">
    ...
    <span className="text-xs text-gray-500">{formatTimestamp(...)}</span>
    <span className="text-xs font-semibold text-blue-600">[{log.source}]</span>
  </div>
  <div className="... bg-linear-to-t from-white to-transparent" />
</div>
```

### 2-3. `StreamsView` 내부 로그 영역 white 전환

```tsx
// 변경 전: 스트림 헤더
className="... bg-white/5 hover:bg-white/10"
// 변경 후
className="... bg-gray-50 hover:bg-gray-100"

// 변경 전: 스트림 아이콘/텍스트 색상
className="text-gray-400"   // 펼치기 아이콘
className="text-blue-400"   // job 텍스트
className="text-gray-500"   // entries 수
// 변경 후
className="text-gray-500"
className="text-blue-600"
className="text-gray-400"

// 변경 전: 배경 wrapper
<div className="relative overflow-hidden rounded-2xl border border-slate-700/60 shadow-lg">
  <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-800 to-black" />
  <div className="relative h-[55vh] ...">
// 변경 후
<div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
  <div className="h-[55vh] min-h-[320px] max-h-[500px] overflow-y-auto bg-white p-4 font-mono text-sm">

// fade overlay
// 변경 전: from-gray-900
// 변경 후: from-white

// EmptyState 한국어 (StreamsView 내부)
// 변경 전
<EmptyState icon="log" title="No matching streams" description="Adjust label filters to see log streams" />
// 변경 후
<EmptyState icon="log" title="일치하는 스트림 없음" description="레이블 필터를 조정하면 로그 스트림이 표시됩니다" />
```

### 2-4. `LogStats` / `StreamStats` 영어 레이블 한국어 전환 (optional, 범위 내)

```tsx
// LogStats
label={activeView === 'syslog' ? 'Total Logs' : 'Total Alerts'}
// → label={activeView === 'syslog' ? '전체 로그' : '전체 알림'}

// StreamStats
label="Streams" → label="스트림"
```

### 2-5. `EnhancedServerModal.utils.ts` — `normalizeServerData` 타입 추론 강화

```ts
// 신규 헬퍼 추가
function inferServerTypeFromId(id: string): string {
  const lower = id.toLowerCase();
  if (lower.startsWith('web-')) return 'web';
  if (lower.startsWith('api-')) return 'application';
  if (lower.startsWith('db-mysql-') || lower.startsWith('db-pg-')) return 'database';
  if (lower.startsWith('db-redis-') || lower.startsWith('cache-')) return 'cache';
  if (lower.startsWith('storage-') || lower.startsWith('nfs-')) return 'storage';
  if (lower.startsWith('lb-') || lower.startsWith('haproxy-')) return 'load-balancer';
  if (lower.startsWith('monitoring-') || lower.startsWith('metrics-')) return 'monitoring';
  return 'unknown';
}

// normalizeServerData 수정
export function normalizeServerData(server: Server): SafeServer {
  const inferredType =
    server.type || inferServerTypeFromId(server.id ?? server.name ?? '');
  return {
    ...
    type: inferredType || 'unknown',
    ...
  };
}
```

### 2-6. `ServerDetailView` — 타입 표시 개선

```tsx
// 변경 전
<p className="mt-1 text-sm text-slate-500">
  {safeServer.type} · {safeServer.location}
</p>

// 변경 후
const TYPE_LABELS: Record<string, string> = {
  web: 'Web',
  application: 'Application',
  database: 'Database',
  cache: 'Cache',
  storage: 'Storage',
  'load-balancer': 'Load Balancer',
  loadbalancer: 'Load Balancer',
  monitoring: 'Monitoring',
  security: 'Security',
  backup: 'Backup',
  queue: 'Queue',
  log: 'Log',
  app: 'App',
  unknown: '타입 미확인',
};

<p className="mt-1 text-sm text-slate-500">
  {TYPE_LABELS[safeServer.type] ?? safeServer.type} · {safeServer.location}
</p>
```

---

## 3. Task 목록

### Phase 1 — dark 배경 white 전환 (P0, ~0.5일)

- [x] **D1**: `EnhancedServerModal.LogsTab.parts.tsx` — `getLogLevelStyles` textClass dark→light 수정
- [x] **D2**: `LegacyLogView` — 배경 dark→white, border 색상, 타임스탬프/소스 텍스트 색상, fade overlay
- [x] **D3**: `StreamsView` — 스트림 헤더 `bg-white/5`→`bg-gray-50`, 텍스트 색상, 배경 wrapper, fade overlay
- [x] **D4**: `StreamsView` EmptyState 영어→한국어
- [x] **D5**: `LogStats` / `StreamStats` 레이블 영어→한국어

### Phase 2 — 서버 타입 "unknown" 수정 (P0, ~0.5일)

- [x] **D6**: `EnhancedServerModal.utils.ts` — `inferServerTypeFromId` 헬퍼 추가
- [x] **D7**: `normalizeServerData` — `server.type || inferServerTypeFromId(id)` 적용
- [x] **D8**: `ServerDetailView` — `TYPE_LABELS` 매핑 추가 + 헤더 표시 개선
- [x] **D9**: 단위 테스트: `normalizeServerData` id 기반 타입 추론 검증 (D5, D6 계약)

### Phase 3 — 브라우저 검증 (P0, ~0.5일)

- [x] **D10**: 로그 탭 시각 확인 — white 배경, 텍스트 가독성, error/warn/info 행 색상
- [x] **D11**: `api-was-dc1-01` 서버 상세 페이지 — 타입 "Application" 표시 확인
- [x] **D12**: `web-nginx-dc1-01` 서버 상세 페이지 — 타입 "Web" 표시 확인
- [x] **D13**: 스트림 뷰 필터 칩 + 로그 엔트리 가독성 확인

---

## 4. 완료 검증 (2026-05-01)

- 단위/컴포넌트: `dashboard-route-contract`, `EnhancedServerModal.utils`, `ServerDetailView`, `LogsTab.parts`, `EnhancedServerModal` targeted 44/44 통과
- 정적 검증: `npm run type-check`, `npm run lint:changed`, `git diff --check` 통과
- Chrome DevTools: `/dashboard/servers/api-was-dc1-01`에서 `Application · DC1-AZ1` 표시, `unknown · DC1-AZ1` 미표시
- Chrome DevTools: `/dashboard/servers/web-nginx-dc1-01`에서 `Web · DC1-AZ1` 표시, 404 미발생
- Chrome DevTools: 로그/스트림 탭에서 dark remnant class 0건, Streams empty copy 한국어 표시
- 추가 보정: Next.js 16 `cacheComponents` 환경에서 서버 상세 동적 라우트가 404/500으로 흔들리지 않도록 registry 기반 `generateStaticParams` 추가

## 4. 변경 금지 범위

- `LegacyLogView`, `StreamsView` 데이터 로직·props 변경 없음
- `getLogLevelStyles` 반환 키(`containerClass`, `badgeClass`, `textClass`) 변경 없음
- `normalizeServerData` 반환 타입 변경 없음
- OTel 데이터 로더 변경 없음

---

## 5. 참조

- 수정 대상: `src/components/dashboard/EnhancedServerModal.LogsTab.parts.tsx`
- 수정 대상: `src/components/dashboard/EnhancedServerModal.utils.ts`
- 수정 대상: `src/components/dashboard/ServerDetailView.tsx`
- 참조 완료 파일: `src/components/dashboard/log-explorer/LogExplorerModal.tsx` (white 전환 패턴)
- OTel 카탈로그: `public/data/otel-data/resource-catalog.json` (`server.role` 필드)
