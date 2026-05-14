> Owner: project
> Status: Draft
> Doc type: How-to
> Last reviewed: 2026-05-14

# 아티팩트 UX 개선 계획서

**작성 배경**: v8.11.147 QA 이후 Playwright MCP 실점검에서 식별된 두 가지 개선 축.
- **UX 개선** (T1~T4): 기존 아티팩트 렌더링·진입 경로 버그 수정
- **페이로드 강화** (T5~T8): 기존 두 아티팩트에 새 데이터 섹션 추가 (새 아티팩트 타입 0개, 새 API 엔드포인트 0개)

---

## 계약 (Contract)

### 범위
- `src/hooks/ai/core/chat-artifact-metadata.ts` — 도구명 레이블
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx` — "이상감지/추세에서 보기" 딥링크
- `src/components/ai/IncidentReportArtifactCard.tsx` — "장애 보고서에서 보기" 딥링크
- `src/lib/ai/chat-artifacts/artifact-workspace-store.ts` — 탭 이동 시 아티팩트 전달
- `src/hooks/ai/core/chat-artifact-execution.ts` — ops-procedure 패치 패턴
- `src/components/ai/pages/IntelligentMonitoringPage.tsx` — 외부 아티팩트 수신

### 변경 불가 영역
- `ArtifactEnvelope` 타입 구조 (`types.ts`) — 계약 버전 유지
- `classifyChatArtifactIntent` 규칙 패턴 — 별도 intent 개선 작업으로 처리

### 완료 기준 — UX 개선
- [ ] UI에서 내부 함수명이 노출되지 않음
- [ ] 채팅에서 생성한 아티팩트를 탭에서 바로 확인 가능
- [ ] ops-procedure 수정 시 이전 아티팩트가 보존됨
- [ ] server-monitoring-analysis가 intent 경로로도 트리거 가능

### 완료 기준 — 페이로드 강화
- [ ] 이상감지/추세 카드에 용량 소진 예측(시간) 표시
- [ ] 이상감지/추세 카드에 역할별(web/db/cache) 그룹 요약 표시
- [ ] 장애 보고서 카드에 반복 로그 패턴 집계 표시
- [ ] 장애 보고서 카드에 경고 지속 시간(분) 표시

---

## 테스트 시나리오

```
[UX 개선]
T1: AI Chat "이상감지 분석해줘" → 분석 근거에 "이상감지/추세 분석" 표시 (내부 함수명 아님)
T2: AI Chat 아티팩트 생성 → "이상감지/추세에서 보기" 클릭 → 탭에 동일 결과 표시
T3: "스크립트 임계치 80으로 바꿔줘" → 이전 ops-procedure 아티팩트가 히스토리에 남음
T4: 서버 클릭 → 단일 서버 이상감지 카드가 채팅 흐름으로 렌더링됨

[페이로드 강화]
T5: 이상감지/추세 분석 실행 → 카드에 "cache-redis-dc1-01 MEM 83% → 약 56시간 후 100%" 표시
T6: 이상감지/추세 분석 실행 → 카드에 database/cache/web 역할별 그룹 요약 표시
T7: 장애 보고서 생성 → 카드에 반복 로그 패턴 상위 3건 표시
T8: 장애 보고서 생성 → 카드에 "경고 지속 30분" 영향 시간 표시
```

---

## Tasks

### Task 1 — 내부 도구명 UI 노출 제거 `P1`

**문제**: 분석 근거 영역에 `generateMonitoringAnalysisArtifact` 같은 내부 함수명 노출.

**원인**: `chat-artifact-metadata.ts`에서 도구명 레이블을 함수명 그대로 사용.

**수정 방향**:
```typescript
// 현재 (추정)
toolName: 'generateMonitoringAnalysisArtifact'

// 수정 후
const ARTIFACT_TOOL_LABELS: Record<ChatArtifact['kind'], string> = {
  'incident-report':           '장애 보고서 생성',
  'monitoring-analysis':       '이상감지/추세 분석',
  'server-monitoring-analysis':'단일 서버 이상감지 분석',
  'server-snapshot':           '서버 현황 스냅샷',
  'ops-procedure':             '운영 절차 생성',
};
```

- [ ] `chat-artifact-metadata.ts` 도구명 레이블 상수화
- [ ] 기존 레이블 노출 경로 확인 (SidebarMessage, AIWorkspaceMessage)
- [ ] 스냅샷 테스트 업데이트

---

### Task 2 — 채팅→탭 딥링크 아티팩트 전달 `P2`

**문제**: AI Chat에서 생성한 아티팩트를 "이상감지/추세에서 보기" 버튼 클릭 시 탭이 새로 분석을 실행함. 기존 결과를 재활용하지 않음.

**수정 방향**:
- `MonitoringAnalysisArtifactCard`의 "보기" 버튼 클릭 시 `ArtifactWorkspaceStore`에 artifact를 저장
- `IntelligentMonitoringPage` 마운트 시 store에서 pending artifact를 읽어 표시
- store 키: `openmanager-artifact-workspace` (기존 SSOT 유지)

```typescript
// 카드 버튼 핸들러
const handleOpenInTab = () => {
  workspaceStore.saveReplayPack(createArtifactReplayPack(artifact));
  openTab('monitoring-analysis');
};

// IntelligentMonitoringPage
useEffect(() => {
  const pack = workspaceStore.readLatestReplayPack('monitoring-analysis');
  if (pack) setInitialArtifact(pack);
}, []);
```

- [ ] `MonitoringAnalysisArtifactCard` — 탭 이동 전 store 저장 로직 추가
- [ ] `IncidentReportArtifactCard` — 동일 패턴 적용
- [ ] `IntelligentMonitoringPage` — store에서 최신 ReplayPack 읽기
- [ ] `AutoReportPage` — 동일 패턴 적용
- [ ] 저장 TTL: 세션 단위 (탭 닫으면 소멸, 현행 `local-session-first` 정책 유지)

---

### Task 3 — ops-procedure 패치 패턴 불변성 개선 `P3`

**문제**: 기존 아티팩트를 `patchOpsProcedureArtifactFromQuery(existingArtifact, query)`로 직접 수정하면 이전 버전이 히스토리에서 사라짐.

**수정 방향**: 패치 결과를 새 아티팩트로 생성하되, `parentArtifactTraceId`를 첨부해 이전 버전을 참조.

```typescript
// 현재
return patchOpsProcedureArtifactFromQuery(existingArtifact, query);

// 수정 후
const patched = patchOpsProcedureArtifactFromQuery(existingArtifact, query);
return attachArtifactEnvelopeMetadata(patched, {
  sourceMode: 'tool-result',
  traceId: generateTraceId(),
  // parentTraceId는 evidence에 기록 (ArtifactEnvelope 구조 변경 없이)
});
```

- [ ] `patchOpsProcedureArtifactFromQuery` 반환값에 새 traceId 부여
- [ ] 이전 아티팩트 메시지가 채팅 히스토리에 유지되는지 테스트 확인
- [ ] `ops-procedure-artifact.test.ts` 회귀 시나리오 추가

---

### Task 4 — server-monitoring-analysis intent 경로 통합 `P3`

**문제**: `server-monitoring-analysis` 아티팩트가 `chat-artifact-execution.ts`의 switch 분기에 없어 채팅 intent로 트리거 불가. 서버 카드 클릭 경로만 존재.

**수정 방향**:
- intent 분류에 `server-monitoring-analysis` 케이스 추가 (서버 ID 명시 쿼리에 한정)
- 예: "api-was-dc1-01 이상감지 분석해줘" → `server-monitoring-analysis` 아티팩트 생성

```typescript
// chat-artifact-intent.ts — 신규 패턴
const SERVER_ID_MONITORING_PATTERN =
  /([a-z][a-z0-9-]{3,}(?:dc\d?-\d+)?)\s*(이상감지|추세|anomaly|trend)/i;

// chat-artifact-execution.ts switch 추가
case 'server-monitoring-analysis':
  return generateServerMonitoringArtifact({ ... });
```

- [ ] `chat-artifact-intent.ts` — 서버 ID 포함 이상감지 패턴 추가
- [ ] `chat-artifact-execution.ts` switch 케이스 추가
- [ ] intent 테스트 케이스 추가 (`chat-artifact-intent.test.ts`)
- [ ] 서버 ID 파싱 엣지케이스 테스트

---

---

## 페이로드 강화 Tasks

> **원칙**: 새 아티팩트 타입 없음, 새 API 엔드포인트 없음.
> 기존 `MonitoringAnalysisArtifact` / `IncidentReportArtifact` payload에 선택적 필드 추가.

---

### Task 5 — 이상감지/추세: `capacityAlerts[]` 용량 소진 예측 `P2`

**발견**: `MetricTrendResult.thresholdBreach`(willBreachWarning, timeToCritical, humanReadable)가
`CloudRunTrendPrediction` 안에 이미 존재하지만 batch 분석 응답에 포함되지 않음.

**수정 위치**:
- `cloud-run/ai-engine`: `analyze_batch` 응답에 `capacityAlerts[]` 포함
- `src/types/intelligent-monitoring.types.ts`: `MonitoringBatchAnalysisResponse`에 필드 추가
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`: artifact 빌드 시 포함
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`: 용량 예측 섹션 렌더링

```typescript
// MonitoringBatchAnalysisResponse에 추가
capacityAlerts?: Array<{
  serverId: string;
  serverName: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  currentValue: number;
  willBreachWarning: boolean;
  timeToWarningMinutes: number | null;
  willBreachCritical: boolean;
  timeToCriticalMinutes: number | null;
  humanReadable: string;   // "약 56시간 후 경고 임계치 도달 예상"
}>;
```

렌더링 목표:
```
⏱ 용량 소진 예측
cache-redis-dc1-01  MEM 83%  →  약 56시간 후 100%  🔴
db-mysql-dc1-backup  DISK 71%  →  약 193시간 후 100%  🟡
```

- [ ] Cloud Run batch 분석에 capacityAlerts 집계 로직 추가
- [ ] `MonitoringBatchAnalysisResponse` 타입 확장
- [ ] `monitoring-analysis-artifact.ts` artifact 빌드 시 포함
- [ ] `MonitoringAnalysisArtifactCard` 용량 예측 섹션 추가
- [ ] MD 다운로드 포맷에 용량 예측 섹션 포함

---

### Task 6 — 이상감지/추세: `roleGroupSummary[]` 역할별 그룹 요약 `P2`

**발견**: `servers[]`가 flat 배열이라 web/db/cache 역할별 집계 불가.
`resource-catalog.json`에 `server.role`이 있어 **API 수정 없이** 프론트엔드에서 계산 가능.

**수정 위치**:
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`: catalog 로드 + 그룹화
- `src/lib/ai/chat-artifacts/types.ts`: `MonitoringAnalysisArtifact`에 선택적 필드 추가
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`: 그룹 요약 섹션 렌더링

```typescript
// MonitoringAnalysisArtifact에 추가
roleGroupSummary?: Array<{
  role: string;           // 'web' | 'application' | 'database' | 'cache' | 'storage' | 'loadbalancer'
  count: number;
  warningCount: number;
  criticalCount: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
}>;
```

렌더링 목표:
```
🗂 역할별 현황
database  3대  CPU 41%  MEM 63%  DISK 61%  ⚠️ 경고 0
cache     3대  CPU 12%  MEM 74%  DISK 22%  ⚠️ 경고 1
web       3대  CPU 15%  MEM 38%  DISK 28%  ✅ 정상
```

- [ ] `monitoring-analysis-artifact.ts`에서 resource-catalog 로드 및 그룹화 계산
- [ ] `MonitoringAnalysisArtifact` 타입에 `roleGroupSummary` 선택 필드 추가
- [ ] `MonitoringAnalysisArtifactCard` 역할별 요약 섹션 추가
- [ ] MD 다운로드 포맷에 역할별 요약 포함

---

### Task 7 — 장애 보고서: `logPatterns[]` 로그 패턴 집계 `P2`

**발견**: `IncidentReport.timeline[]`에 개별 이벤트만 있고 반복 오류 집계가 없음.
OTel `hourly/*.json` 로그 데이터(severityText, body, resource)를 이미 읽고 있어 집계 로직만 추가하면 됨.
LLM 추가 호출 불필요 — 단순 count + group.

**수정 위치**:
- `src/app/api/ai/incident-report/route.ts` 또는 AI Engine: 로그 집계 로직
- `src/components/ai/pages/auto-report/types.ts`: `IncidentReport`에 선택적 필드 추가
- `src/lib/ai/chat-artifacts/incident-report-artifact.ts`: normalizeIncidentReport 확장
- `src/components/ai/IncidentReportArtifactCard.tsx`: 로그 패턴 섹션 렌더링

```typescript
// IncidentReport에 추가
logPatterns?: Array<{
  message: string;      // "redis slowlog threshold exceeded command=GET"
  count: number;        // 23
  severity: 'ERROR' | 'WARNING' | 'INFO';
  serverId: string;
  firstSeen: string;
  lastSeen: string;
}>;
```

렌더링 목표:
```
📋 반복 로그 패턴
ERROR  23건  cache-redis-dc1-01  "redis slowlog threshold exceeded"
WARN   18건  cache-redis-dc1-01  "memory usage 83% of maxmemory limit"
```

- [ ] incident-report API에서 OTel 로그 ERROR/WARN 집계 추가 (상위 5건)
- [ ] `IncidentReport` 타입에 `logPatterns` 선택 필드 추가
- [ ] `incident-report-artifact.ts` normalizeIncidentReport에서 logPatterns 파싱
- [ ] `IncidentReportArtifactCard` 로그 패턴 섹션 추가
- [ ] MD 다운로드 포맷에 로그 패턴 섹션 포함

---

### Task 8 — 장애 보고서: `uptimeImpact` 가용성 영향 시간 `P3`

**발견**: `systemSummary`에 서버 카운트만 있고 "얼마나 오래 경고 상태였나"가 없음.
OTel 슬롯(10분 단위)의 status 집계로 **API 수정 없이** 계산 가능.

**수정 위치**:
- `src/lib/ai/chat-artifacts/incident-report-artifact.ts`: normalizeSystemSummary 확장
- `src/components/ai/pages/auto-report/types.ts`: `systemSummary` 확장
- `src/components/ai/IncidentReportArtifactCard.tsx`: 가용성 영향 렌더링

```typescript
// systemSummary에 추가
systemSummary?: {
  totalServers: number;
  healthyServers: number;
  warningServers: number;
  criticalServers: number;
  // 추가
  uptimePercent?: number;             // 97.9%
  affectedDurationMinutes?: number;   // 30 (경고 이상 슬롯 수 × 10분)
  dataSlotLabel?: string;             // "14:20 KST"
};
```

렌더링 목표:
```
가용률 97.9%  |  경고 지속 30분  |  기준 14:20 KST
```

- [ ] `normalizeSystemSummary`에서 OTel 슬롯 상태 집계 로직 추가
- [ ] `systemSummary` 타입 확장 (기존 필드 유지, 선택적 추가)
- [ ] `IncidentReportArtifactCard` 헤더에 가용성 영향 표시
- [ ] 슬롯 데이터 없을 때 graceful 생략 처리

---

## 우선순위 및 예상 공수

| Task | 대상 아티팩트 | Priority | 예상 공수 | 의존 |
|------|:------------:|:--------:|:---------:|------|
| T1 도구명 레이블 | 공통 | P1 | 30분 | 없음 |
| T2 딥링크 아티팩트 전달 | 공통 | P2 | 2~3h | T1 |
| T5 capacityAlerts 용량 예측 | 이상감지/추세 | P2 | 3~4h | 없음 |
| T6 roleGroupSummary 역할별 요약 | 이상감지/추세 | P2 | 2h | 없음 |
| T7 logPatterns 로그 패턴 | 장애 보고서 | P2 | 2~3h | 없음 |
| T3 ops-procedure 불변성 | ops-procedure | P3 | 1~2h | 없음 |
| T4 server intent 통합 | 공통 | P3 | 2~3h | 없음 |
| T8 uptimeImpact 가용성 영향 | 장애 보고서 | P3 | 1~2h | T7 |

**총 예상 공수**: 14~19시간

---

## 참조

**UX 개선 관련**
- 아티팩트 타입: `src/lib/ai/chat-artifacts/types.ts`
- intent 분류: `src/lib/ai/chat-artifacts/chat-artifact-intent.ts`
- 실행 흐름: `src/hooks/ai/core/chat-artifact-execution.ts`
- workspace store: `src/lib/ai/chat-artifacts/artifact-workspace-store.ts`

**페이로드 강화 관련**
- 이상감지 타입: `src/types/intelligent-monitoring.types.ts`
- 장애 보고서 타입: `src/components/ai/pages/auto-report/types.ts`
- 이상감지 artifact 빌드: `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`
- 장애 보고서 artifact 빌드: `src/lib/ai/chat-artifacts/incident-report-artifact.ts`
- OTel 데이터: `public/data/otel-data/` (timeseries.json, hourly/, resource-catalog.json)

**QA 근거**: 2026-05-14 Playwright MCP 실점검 (v8.11.147)
