<!-- Owner: project -->
<!-- Status: Completed -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-05-01 -->

# Dashboard Server & Log UX 개선 계획

- TODO.md 연결: Active Tasks > Dashboard Server & Log UX 개선
- 상태: Completed
- 작성일: 2026-04-30
- 승인일: 2026-05-01
- 구현 착수 조건: Phase 단위 `test(spec)` 선행 커밋 후 구현

> 개요(Overview) 섹션은 **변경 금지**. 서버 섹션과 로그 섹션만 대상.

---

## 0. 개요 섹션 모달 버튼 처리 검토 결과

개요 섹션의 3개 액션 버튼(`활성 알림`, `알림 이력`, `로그 검색`)은 과거 **모달(overlay)** 로 띄웠으나,  
`faf0c996f` (feat: dashboard app shell route navigation) 커밋에서 **라우트 이동**으로 전환됨.

```
DashboardContent.tsx:226  onOpenAlertHistory={() => router.push('/dashboard/alerts')}
DashboardContent.tsx:227  onOpenLogExplorer ={() => router.push('/dashboard/logs')}
DashboardContent.tsx:231  onOpenActiveAlerts={() => router.push('/dashboard/alerts')}
```

**현재 동작 구조**:
```
[활성 알림] 버튼 → DashboardSummary.onOpenActiveAlerts → router.push('/dashboard/alerts')
[알림 이력] 버튼 → DashboardSummary.onOpenAlertHistory → router.push('/dashboard/alerts')
[로그 검색] 버튼 → DashboardSummary.onOpenLogExplorer  → router.push('/dashboard/logs')
```

**이슈**: 활성 알림과 알림 이력이 모두 `/dashboard/alerts`로 이동 — 같은 목적지.  
`/dashboard/alerts` 내부에서 `ActiveAlertsPanel` + `AlertHistoryPanel` 두 패널이 나란히 렌더링되므로 기능은 유지되지만,  
버튼 두 개가 같은 URL을 가리키는 것은 사용자에게 혼란.

**권고**: 개요 섹션 건드리지 않으므로 현행 유지. 단, 추후 알림 섹션 개편 시 앵커(#active / #history)로 구분 고려.

---

## 1. 벤치마크 분석 — 상용/오픈소스 모니터링 도구

### 서버 섹션

| 도구 | 카드 레이아웃 | 상태 표현 | 메트릭 밀도 | 특징 |
|------|-------------|----------|------------|------|
| **Grafana** | 그리드 (2~4열, 사용자 설정) | 색상 테두리 + 상태 아이콘 | 스파크라인 + 현재값 | 패널 드래그/리사이즈 |
| **Datadog** | 리스트 or 맵(tree/heat) 전환 | 색상 배경 행 + 배지 | 미니 시계열 차트 | Watchdog AI 이상감지 배지 |
| **Zabbix** | 밀도 높은 테이블(행) | 심각도별 색 행 | 텍스트 값 + 트렌드 화살표 | 그룹 폴더 계층 |
| **Prometheus+Alertmanager** | 테이블 | 레이블 색상 | 수치만 | 필터 쿼리 중심 |
| **Netdata** | 카드 그리드 (고정 2열) | 게이지 원형 + 색상 | 스파크라인 풍부 | 실시간 1초 갱신 |
| **Checkmk** | 트리 + 테이블 혼합 | RAG (Red/Amber/Green) dot | 임계치 기반 색 강조 | 계층 서비스 뷰 |

**공통 패턴 추출**:
1. **그리드 + 리스트 전환**: 모든 상용 도구가 뷰 토글 제공
2. **상태 색상 테두리/배경**: border-left 4px 컬러가 가장 빠른 시각 스캔
3. **임계치 초과 메트릭만 강조**: 정상 값은 흐리게, 문제 값만 색상
4. **미니 스파크라인**: 현재값 + 24h 추세를 동시에 (Netdata/Datadog)
5. **서버 역할 그룹핑**: LB / Web / DB / Cache 그룹 구분

### 로그 섹션

| 도구 | 레이아웃 | 레벨 표현 | 밀도 | 특징 |
|------|---------|---------|------|------|
| **Kibana (ELK)** | 1줄 압축 행 | 컬러 배지 (ERROR=빨강) | 높음 | 상단 통계 막대그래프 |
| **Grafana Loki** | 1줄 행 + 확장 | 컬러 레이블 | 높음 | LogQL 필터, 컨텍스트 전후 표시 |
| **Datadog Logs** | 1줄 행 | 좌측 컬러 바 | 높음 | 패턴 클러스터링, AI 요약 |
| **Graylog** | 1줄 행 + 열 선택 | 수준별 배경색 | 높음 | 스트림 분리, 저장 검색 |
| **Splunk** | 이벤트 뷰어 | severity 컬러 | 높음 | 통계 차트 + 테이블 복합 |
| **Vector/Loki OSS** | 원시 스트림 | ANSI 색상 | 매우 높음 | 개발자 중심 |

**공통 패턴 추출**:
1. **통계 바 상단 고정**: 전체/레벨별 카운트가 항상 보임 (Kibana, Datadog)
2. **1줄 압축 행**: 서버명·시간·레벨·소스·메시지를 1행에 (확장 클릭으로 상세)
3. **좌측 컬러 바**: ERROR=빨강, WARN=주황, INFO=파랑, DEBUG=회색 (border-left)
4. **가상 스크롤**: 대량 로그(수천~수만)를 페이지 없이 스크롤
5. **같은 패턴 클러스터링**: 반복 로그를 `[×12] message` 형태로 축소
6. **컨텍스트 주변 라인**: 특정 로그 클릭 시 전후 N줄 보기

---

## 2. 설계 — 서버 섹션

### 2-0. 계약 (Contract)

- Overview 섹션 컴포넌트와 라우트 진입점은 수정하지 않는다.
- 서버 섹션은 기존 서버 데이터 shape와 상세 진입 경로를 유지한다.
- 로그 섹션은 기존 로그 데이터 source와 필터 계약을 유지한다.
- 새 UI 상태는 URL query 또는 component state 중 구현 단계에서 확정하되, 기존 `/dashboard/logs`와 `/dashboard/servers` route는 유지한다.

### 2-1. 카드 레이아웃 (뷰 토글)

```
[≡ 리스트]  [▦ 그리드]   정렬: [상태▼]   필터: [전체|온라인|경고|위험]
```

**리스트 뷰** (현행 개선):
```
┌─ WARNING ──────────────────────────────────────────────── lb-haproxy-dc1-01 ─┐
│  로드밸런서 · Linux · DC1-AZ1 · Uptime 406d 11h           [AI] [로그→] [▼]  │
│  CPU ████████░░ 63% ↑   MEM ████░░░░░░ 37%   DSK ███░░░░░░░ 25%             │
└─────────────────────────────────────────────────────────────────────────────┘
  ↑ border-left 4px #f97316(주황) + 헤더 배경 amber-50
```

**그리드 뷰** (신규):
```
┌──────────────────────┐  ┌──────────────────────┐
│▌WARN lb-haproxy      │  │  OK  web-nginx-dc1-01 │
│  CPU  63% ████████░░ │  │  CPU  39% █████░░░░░  │
│  MEM  37% ████░░░░░░ │  │  MEM  42% █████░░░░░  │
│  DSK  25% ███░░░░░░░ │  │  DSK  30% ████░░░░░░  │
│  [AI] [로그] [▼]     │  │             [▼]       │
└──────────────────────┘  └──────────────────────┘
```

### 2-2. 상태 색상 시스템

| 상태 | border-left | 헤더 배경 | 배지 |
|------|------------|---------|------|
| critical | `#ef4444` (red-500) | `red-50` | `bg-red-100 text-red-700` |
| warning | `#f97316` (orange-500) | `amber-50` | `bg-amber-100 text-amber-700` |
| online | `#22c55e` (green-500) | 없음 | `bg-green-100 text-green-700` |
| offline | `#94a3b8` (slate-400) | `slate-50` | `bg-slate-100 text-slate-600` |

### 2-3. 메트릭 강조

임계치(CPU≥70%, MEM≥70%, DSK≥70%) 초과 메트릭만 색상 적용:
```tsx
// 현재: 모든 메트릭 동일 스타일
// 개선: 임계 초과만 강조
const barColor = value >= 85 ? 'bg-red-400' : value >= 70 ? 'bg-amber-400' : 'bg-indigo-400';
const textColor = value >= 85 ? 'text-red-700 font-bold' : value >= 70 ? 'text-amber-700 font-semibold' : 'text-slate-600';
```

### 2-4. 서버 카드 액션 버튼 (로그 Cross-link)

```
[AI 분석]  →  /dashboard/ai-assistant?q=lb-haproxy-dc1-01+분석
[로그 →]   →  /dashboard/logs?server=lb-haproxy-dc1-01
[상세 ▼]   →  /dashboard/servers/lb-haproxy-dc1-01
```

---

## 3. 설계 — 로그 섹션

### 3-1. 상단 통계 바 (고정)

```
┌──────────┬──────────┬──────────┬──────────┐
│전체 9174 │  정보 64 │  경고 35 │  오류  1 │
│          │  (파랑)  │  (주황)  │  (빨강)  │
└──────────┴──────────┴──────────┴──────────┘
클릭 시 해당 레벨 필터 토글
```

### 3-2. 1줄 압축 행 레이아웃

```
┌─ 컬럼 헤더 ──────────────────────────────────────────────────────────────────┐
│  레벨   시간         서버                    소스      메시지                │
├──────────────────────────────────────────────────────────────────────────────┤
│ [WARN] 23:59:51  db-mysql-dc1-backup  [mysqld]  InnoDB Write NFS 1959ms [↗] │
│ [WARN] 23:59:42  storage-nfs-dc1-01   [syslog]  Export /data latency 1857ms │
│[ERROR] 23:57:12  storage-s3gw-dc1-01  [syslog]  Multipart upload stalled    │ ← 행 배경 red-50
│ [INFO] 23:57:24  lb-haproxy-dc1-01   [haproxy]  health checks 16/18         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 레벨 배지: `border-left 3px` 컬러 + 배지
- ERROR 행: 전체 행 `bg-red-50`
- 메시지 말줄임 + 클릭 시 확장(전체 메시지 + 전후 컨텍스트)

### 3-3. 반복 로그 그룹핑

같은 서버의 동일 패턴 연속 로그:
```
▼ storage-nfs-dc1-01 · WARN · nfsd WARNING pressure (×8건)
  23:59:34  cpu=65% mem=40% disk=83%
  23:59:24  cpu=67% mem=40% disk=84%
  [6개 더 보기...]
```

### 3-4. 가상 스크롤

현재: 전체 로드 방식 추정  
개선: `react-virtual` 또는 CSS `contain: strict` + 청크 로드  
9174개 → 50개씩 무한 스크롤

---

## 4. Task 목록

### Phase 1 — CSS/스타일만 (P0, ~1일)

- [x] **T1**: 서버 카드 상태별 `border-left` 컬러 적용 (`ServerCard.tsx` 또는 `ServerDashboard.tsx`)
- [x] **T2**: 임계치 초과 메트릭 행 색상 강조 (CPU/MEM/DSK 바 + 수치 텍스트)
- [x] **T3**: 로그 레벨 컬러 배지 (`[WARN]` → `bg-amber-100 text-amber-700 border-l-2 border-amber-400`)
- [x] **T4**: 로그 ERROR 행 `bg-red-50` 전체 행 강조
- [x] **T5**: 로그 통계(전체/정보/경고/오류)를 필터바 위 상단으로 이동 + 클릭 필터 연동

#### Phase 1 테스트 계약

- `LogExplorerPanel`은 ERROR 레벨 로그 행에 전체 행 강조 배경을 적용한다.
- 로그 통계 셀은 클릭 가능한 필터 컨트롤이며, 클릭 시 해당 레벨 필터가 토글된다.
- `ImprovedServerCard` 또는 서버 카드 표시 계층은 상태별 좌측 accent border를 제공한다.
- CPU/MEM/DSK 임계치 70% 이상 수치는 텍스트 색/weight로도 강조된다.
- 기존 Overview 섹션과 `/dashboard` 개요 라우트 진입점은 변경하지 않는다.

#### Phase 1 구현 로그 (2026-05-01)

- SDD 선행 테스트 커밋: `b2a4e096e test(spec): dashboard server log phase1 contracts`
- 구현 커밋: `17322154a feat(dashboard): implement server log phase1 polish`
- 서버 카드 상태별 좌측 accent border 추가.
- CPU/MEM/DSK/Network 70% 이상 수치 텍스트 강조, 85% 이상 red 강조로 정렬.
- 로그 ERROR 행 전체 `bg-red-50` 강조 및 error row 텍스트 대비 보정.
- 로그 통계 바를 필터 상단으로 이동하고 `전체/정보/경고/오류` 클릭 필터 토글 추가.
- T3 로그 레벨 좌측 border/badge는 기존 구현을 확인하고 Phase 1 범위 완료로 체크.
- 검증: targeted dashboard component tests 48/48, root type-check, `lint:changed`, `test:quick`, `git diff --check` 통과.

### Phase 2 — 레이아웃 변경 (P1, ~2일)

- [x] **T6**: 서버 뷰 토글 (`[≡ 리스트][▦ 그리드]`) + 그리드 2열 레이아웃
- [x] **T7**: 서버 카드 정렬 셀렉트 (상태/CPU/MEM/이름)
- [x] **T8**: 로그 행 1줄 압축 + 클릭 확장 (현재 2~3줄 → 1줄 기본, 클릭 시 상세)

#### Phase 2 구현 로그 (2026-05-01)

- SDD 선행 테스트 커밋: `e0a30666d test(spec): dashboard server log phase2 contracts`
- 구현 커밋: `7a681bb23 feat(dashboard): implement server log phase2 controls`
- 서버 목록 상단에 리스트/그리드 보기 토글 추가. 기본은 운영 대시보드 스캔에 맞춰 리스트, 그리드는 2열로 고정.
- 서버 정렬 셀렉트를 추가해 상태/CPU/MEM/이름 기준으로 카드 순서를 전환.
- 로그 행을 기본 1줄 압축 버튼으로 바꾸고, 클릭 시 메시지 전체를 `whitespace-pre-wrap`으로 확장.
- 필터/초기화/더보기 동작 시 확장 로그 상태를 초기화해 이전 행 확장 상태가 다른 결과에 남지 않도록 정렬.
- 검증: targeted dashboard component tests 10/10, root type-check, `lint:changed`, `test:quick`, `git diff --check` 통과.

### Phase 3 — 기능 추가 (P2, ~3일)

- [x] **T9**: 서버 카드 `[로그 →]` Cross-link (`/dashboard/logs?server=xxx`)
- [x] **T10**: 로그 반복 패턴 그룹핑 (같은 서버·같은 패턴 연속 시 축소)
- [x] **T11**: 로그 가상 스크롤 (50개씩 청크)

#### Phase 3 구현 로그 (2026-05-01)

- SDD 선행 테스트 커밋: `1fb32767b test(spec): dashboard server log phase3 contracts`
- 구현 커밋: `73eda44f9 feat(dashboard): implement server log phase3 interactions`
- QA 보정 커밋: `94487ec80 fix(dashboard): improve stat filter touch targets`
- 서버 카드에 로그 바로가기 아이콘 버튼을 추가하고 `/dashboard/logs?server=<serverId>`로 이동하도록 연결.
- 로그 페이지는 `server`/`serverId` URL query를 초기 서버 필터로 반영하고, 로그 API는 `serverId` query를 명시적으로 사용.
- 로그 행은 같은 서버·레벨·소스·정규화 메시지 패턴이 연속될 때 `×N` 그룹으로 축소하고, 클릭 시 하위 반복 로그 샘플을 표시.
- 로그 목록은 최초 50개 렌더링, 스크롤/더보기 시 50개씩 추가하며 100개 이후는 다음 API page를 가져와 이어 표시.
- QA에서 발견한 로그 통계 필터 버튼 높이 22px 이슈를 `StatCell` 44px touch target으로 보정.
- 검증: targeted dashboard/log tests 64/64, QA 보정 targeted tests 13/13, root type-check, `lint:changed`, `test:quick`, `git diff --check` 통과.
- 로컬 Playwright MCP QA: 서버 로그 버튼 15개 렌더링 및 44px target 확인, 서버→로그 링크 이동, URL 기반 서버 필터 적용, 로그 청크 50→100→150 증가, console error 0, horizontal overflow 0 확인.

---

## 5. 변경 금지 범위

- `src/components/dashboard/SystemOverviewSection.tsx` — 개요 게이지/Top5 알림
- `src/components/dashboard/DashboardSummary.tsx` — 개요 헤더 통계/버튼
- `src/app/dashboard/page.tsx` — 개요 라우트 진입점
- `DashboardContent.tsx` 내 개요 관련 props 전달부

---

## 6. 참조

- 벤치마크: Grafana, Datadog, Kibana, Graylog, Netdata, Checkmk, Zabbix
- 서버 카드 현재 구현: `src/components/dashboard/ServerDashboard.tsx`
- 로그 현재 구현: `src/components/dashboard/log-explorer/LogExplorerModal.tsx`, `src/app/dashboard/logs/page.tsx`
- 개요 모달→라우트 전환 커밋: `faf0c996f`
