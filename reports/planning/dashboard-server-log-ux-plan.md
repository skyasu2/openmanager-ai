<!-- Owner: project -->
<!-- Status: Draft -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-04-30 -->

# Dashboard Server & Log UX 개선 계획

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

- [ ] **T1**: 서버 카드 상태별 `border-left` 컬러 적용 (`ServerCard.tsx` 또는 `ServerDashboard.tsx`)
- [ ] **T2**: 임계치 초과 메트릭 행 색상 강조 (CPU/MEM/DSK 바 + 수치 텍스트)
- [ ] **T3**: 로그 레벨 컬러 배지 (`[WARN]` → `bg-amber-100 text-amber-700 border-l-2 border-amber-400`)
- [ ] **T4**: 로그 ERROR 행 `bg-red-50` 전체 행 강조
- [ ] **T5**: 로그 통계(전체/정보/경고/오류)를 필터바 위 상단으로 이동 + 클릭 필터 연동

### Phase 2 — 레이아웃 변경 (P1, ~2일)

- [ ] **T6**: 서버 뷰 토글 (`[≡ 리스트][▦ 그리드]`) + 그리드 2열 레이아웃
- [ ] **T7**: 서버 카드 정렬 셀렉트 (상태/CPU/MEM/이름)
- [ ] **T8**: 로그 행 1줄 압축 + 클릭 확장 (현재 2~3줄 → 1줄 기본, 클릭 시 상세)

### Phase 3 — 기능 추가 (P2, ~3일)

- [ ] **T9**: 서버 카드 `[로그 →]` Cross-link (`/dashboard/logs?server=xxx`)
- [ ] **T10**: 로그 반복 패턴 그룹핑 (같은 서버·같은 패턴 연속 시 축소)
- [ ] **T11**: 로그 가상 스크롤 (50개씩 청크)

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
