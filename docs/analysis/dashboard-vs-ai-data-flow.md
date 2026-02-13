# 대시보드 vs AI 데이터 흐름 비교 분석

> Status: Historical
> Current canonical docs: `docs/README.md`, `docs/reference/README.md`
> Note: 본 문서는 작성 시점 기준 분석/리뷰 기록입니다.

> **분석 일시**: 2026-02-06
> **분석 유형**: 리서치/비교 분석 (코드 변경 없음)
> **상태**: ✅ 분석 완료

---

## 0. 핵심 결론 (TL;DR)

| 항목 | 대시보드 (Vercel) | AI Engine (Cloud Run) | 일관성 |
|------|------------------|----------------------|:------:|
| **데이터 소스** | `hourly-data/*.json` | `hourly-data/*.json` | ✅ 동일 |
| **임계값** | `system-rules.json` | `system-rules.json` | ✅ 동일 |
| **상태 판별** | `determineStatus()` | `determineStatus()` | ✅ 동일 |
| **시간 계산** | KST 10분 슬롯 | KST 10분 슬롯 | ✅ 동일 |
| **Fallback** | `FIXED_24H_DATASETS` | `FIXED_24H_DATASETS` | ✅ 동일 |

**결론**: 대시보드와 AI가 **동일한 SSOT(Single Source of Truth)**에서 데이터를 가져오므로 일관성 보장됨.

---

## 1. 전체 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSOT (Single Source of Truth)                 │
├─────────────────────────────────────────────────────────────────┤
│  📁 /src/data/hourly-data/hour-{00..23}.json (Prometheus 형식)  │
│  📁 /src/config/rules/system-rules.json (임계값)                 │
│  📁 /src/data/fixed-24h-metrics.ts (Fallback)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌─────────────────────────┐          ┌─────────────────────────────┐
│     Vercel Dashboard     │          │    Cloud Run AI Engine      │
├─────────────────────────┤          ├─────────────────────────────┤
│ MetricsProvider.ts       │          │ precomputed-state.ts        │
│  ↓ 번들 import           │          │  ↓ fs.readFileSync          │
│ targetToServerMetrics()  │          │ targetToRawServer()         │
│  ↓                       │          │  ↓                          │
│ ServerMetrics API        │          │ 144슬롯 Pre-computed        │
│  ↓                       │          │  ↓                          │
│ useServerDashboard()     │          │ getLLMContext() ~100토큰    │
│  ↓                       │          │  ↓                          │
│ ImprovedServerCard       │          │ AI System Message 주입      │
│ EnhancedServerModal      │          │                             │
└─────────────────────────┘          └─────────────────────────────┘
```

---

## 2. 대시보드 데이터 수집 방식

### 2.1 데이터 페칭 계층

```
Page Load (SSR)
    ↓
getDashboardData() [서버 사이드]
    ↓
getServersFromUnifiedSource()
    ↓
MetricsProvider.getAllServerMetrics()
    ↓
hourly-data/*.json 번들 로드
    ↓
DashboardClient (hydration)
    ↓
useServerDashboard() Hook
    ├─ useServerQuery (React Query)
    ├─ useServerDataCache
    ├─ useServerPagination
    └─ useServerStats
```

### 2.2 주요 API 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `/api/servers-unified` | **메인 서버 목록** (인증 불필요) |
| `/api/servers/all` | 전체 서버 데이터 |
| `/api/metrics/current` | 현재 메트릭 조회 |
| `/api/system` | 시스템 상태 정보 |

### 2.3 상태 관리

| 유형 | 도구 | 용도 |
|------|------|------|
| 전역 상태 | Zustand | AI Sidebar, System Control |
| 서버 상태 | React Query | 캐싱 + 자동 갱신 (30초) |
| 로컬 상태 | useState | 페이지네이션, 필터, 선택 |

### 2.4 캐싱 전략 (3단계)

```
1. MetricsProvider 캐시 (메모리)
   └─ hourly-data 로드 후 유지

2. React Query 캐시
   └─ staleTime: 30초
   └─ gcTime: 5분

3. UnifiedServerDataSource 캐시
   └─ TTL: 10분
```

---

## 3. ServerCard & Modal 데이터 표시

### 3.1 ImprovedServerCard Props

```typescript
interface ImprovedServerCardProps {
  server: ServerType;
  onClick: (server) => void;
  variant?: 'compact' | 'standard' | 'detailed';
  showRealTimeUpdates?: boolean;
  enableProgressiveDisclosure?: boolean;
}
```

### 3.2 표시 데이터

| 영역 | 데이터 |
|------|--------|
| **헤더** | 서버명, 타입+OS 아이콘, 위치, 실시간 인디케이터 |
| **메트릭** | CPU, Memory (+ 10시간 미니 차트) |
| **AI** | AI Insight Badge |
| **호버** | Services 목록 (Progressive Disclosure) |
| **펼침** | OS, Uptime, IP 주소 |

### 3.3 색상 코딩

| 값 | 색상 | 상태 |
|----|------|------|
| ≥90% | `#ef4444` (Red) | Critical |
| ≥80% | `#f97316` (Orange) | Warning |
| <80% | `#10b981` (Emerald) | Normal |

### 3.4 EnhancedServerModal 탭 구조

| 탭 | 내용 |
|----|------|
| Overview | 3D 게이지 (CPU/Memory/Disk) + 시스템 정보 |
| Metrics | 시계열 차트 (6h/24h/7d) + 예측/이상탐지 |
| Logs | 메트릭 기반 자동생성 로그 |
| Processes | 서비스/프로세스 목록 |
| Network | 네트워크 상세 정보 |

### 3.5 실시간 업데이트

```typescript
// useFixed24hMetrics Hook
const { currentMetrics, historyData } = useFixed24hMetrics(serverId);

// 업데이트 주기: 10분 (600,000ms)
// 데이터 소스: hourly-data/hour-XX.json
// 히스토리: 최대 60개 포인트 (10시간)
```

---

## 4. AI Engine 데이터 사용 방식

### 4.1 데이터 로드 우선순위

```typescript
// cloud-run/ai-engine/src/data/precomputed-state.ts

1. precomputed-states.json 로드 (최적, ~1.2MB)
   → 콜드 스타트: 2-3ms
   ↓ 없으면
2. hourly-data/*.json에서 144슬롯 런타임 빌드
   → 콜드 스타트: 3-5초
   ↓ 없으면
3. FIXED_24H_DATASETS 폴백 (TypeScript 하드코딩)
```

### 4.2 AI 컨텍스트 주입

```typescript
// src/app/api/ai/supervisor/server-context.ts

export function buildServerContextMessage(): NormalizedMessage | null {
  const monitoring = MonitoringContext.getInstance();
  const context = monitoring.getLLMContext();  // ~100 토큰

  return {
    role: 'system',
    content: `${context}\n위 모니터링 데이터를 참조하여...`
  };
}
```

### 4.3 getLLMContext() 출력 예시

```
System Health: 92/100 (Good)
Active Alerts (3): web-01 CPU=82% [WARNING], ...
By Type: web(3) avg CPU 45% | api(3) avg CPU 62% | ...
```

---

## 5. 데이터 일관성 비교

### 5.1 Prometheus JSON → 변환 비교

| 단계 | Vercel | Cloud Run |
|------|--------|-----------|
| 원본 | `hour-14.json` targets | 동일 |
| 변환 함수 | `targetToServerMetrics()` | `targetToRawServer()` |
| 출력 | `ServerMetrics` | `ServerSnapshot` |
| CPU 값 | `target.metrics.node_cpu_usage_percent` | 동일 |
| 상태 판별 | `determineStatus(cpu, mem, disk, net)` | 동일 |

### 5.2 임계값 동기화

```json
// /src/config/rules/system-rules.json (SSOT)
{
  "thresholds": {
    "cpu": { "warning": 80, "critical": 90 },
    "memory": { "warning": 80, "critical": 90 },
    "disk": { "warning": 80, "critical": 90 },
    "network": { "warning": 70, "critical": 85 }
  }
}
```

- **Vercel**: `loader.ts` → `getRulesServerStatus()`
- **Cloud Run**: `loadThresholdsFromSystemRules()` → 동일 파일 읽기

### 5.3 시간 인덱싱

| 항목 | Vercel | Cloud Run |
|------|--------|-----------|
| 시간대 | KST (UTC+9) | KST (UTC+9) |
| 슬롯 단위 | 10분 | 10분 |
| 슬롯 계산 | `minuteOfDay / 10` | `slotIndex (0-143)` |
| 예: 14:30 | minuteOfDay=870 | slotIndex=87 |

---

## 6. 차이점 (최적화 전략)

| 구분 | Vercel | Cloud Run | 이유 |
|------|--------|-----------|------|
| **로드 방식** | 번들 (정적 import) | fs.readFileSync | Serverless vs 지속 인스턴스 |
| **계산 시점** | 온디맨드 | Pre-computed | 토큰 절감, 응답 속도 |
| **캐시** | hourly-data (시간당) | precomputed-states.json | Cold start 방지 |
| **출력 형식** | ServerMetrics (상세) | CompactContext (~100토큰) | API vs LLM 용도 |

---

## 7. 핵심 파일 참조

### Vercel (Frontend)

| 파일 | 역할 |
|------|------|
| `src/app/dashboard/page.tsx` | SSR 진입점 |
| `src/app/dashboard/DashboardClient.tsx` | 클라이언트 상태 관리 |
| `src/services/metrics/MetricsProvider.ts` | SSOT 메트릭 제공 |
| `src/hooks/useServerDashboard.ts` | 메인 대시보드 훅 |
| `src/components/dashboard/ImprovedServerCard.tsx` | 서버 카드 UI |
| `src/components/dashboard/EnhancedServerModal.tsx` | 상세 모달 |
| `src/hooks/useFixed24hMetrics.ts` | 실시간 메트릭 훅 |

### Cloud Run (AI Engine)

| 파일 | 역할 |
|------|------|
| `cloud-run/ai-engine/src/data/precomputed-state.ts` | O(1) 상태 조회 |
| `cloud-run/ai-engine/src/data/fixed-24h-metrics.ts` | 24시간 시계열 |
| `src/app/api/ai/supervisor/server-context.ts` | AI 컨텍스트 주입 |
| `src/services/monitoring/MonitoringContext.ts` | 모니터링 컨텍스트 |

### 공유 SSOT

| 파일 | 역할 |
|------|------|
| `src/data/hourly-data/hour-*.json` | 24시간 Prometheus 데이터 |
| `src/config/rules/system-rules.json` | 임계값 규칙 |
| `src/data/fixed-24h-metrics.ts` | Fallback 데이터 |

---

## 8. 다이어그램: 데이터 일관성 보장

```
┌─────────────────────────────────────────────────────────────────┐
│                    hour-14.json (예시)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ targets["web-nginx-icn-01:9100"].metrics                  │  │
│  │   node_cpu_usage_percent: 45.2                            │  │
│  │   node_memory_usage_percent: 68.5                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌─────────────────────────┐          ┌─────────────────────────────┐
│   Vercel Dashboard       │          │   Cloud Run AI Engine       │
├─────────────────────────┤          ├─────────────────────────────┤
│ ServerMetrics {          │          │ ServerSnapshot {            │
│   serverId: "web-...",   │          │   id: "web-...",            │
│   cpu: 45.2,       ────────────────────→ cpu: 45.2,               │
│   memory: 68.5,    ────────────────────→ memory: 68.5,            │
│   status: "online" ────────────────────→ status: "online"         │
│ }                        │          │ }                           │
└─────────────────────────┘          └─────────────────────────────┘
         │                                         │
         ▼                                         ▼
   ServerCard 표시                           AI 컨텍스트 주입
   "CPU: 45.2%"                              "web-01: CPU 45%"
   ✅ 일치                                    ✅ 일치
```

---

## 9. 결론

### ✅ 일관성 보장 포인트

1. **동일 SSOT**: `hourly-data/*.json` 원본 공유
2. **동일 임계값**: `system-rules.json` 파일 공유
3. **동일 상태 로직**: `determineStatus()` 함수 동일
4. **동일 시간 계산**: KST 기준, 10분 슬롯 동일
5. **동일 Fallback**: `FIXED_24H_DATASETS` 공유

### 아키텍처 장점

1. **SSOT 원칙 준수**: 데이터 불일치 원천 차단
2. **최적화 분리**: Vercel은 UI용, Cloud Run은 LLM용 최적화
3. **Fallback 체계**: 데이터 로드 실패 시에도 동작 보장
4. **토큰 효율성**: AI는 ~100토큰 컨텍스트로 비용 절감

### 주의 사항

1. **배포 동기화**: Cloud Run 배포 시 `system-rules.json` 복사 확인
2. **Pre-computed 캐시**: `precomputed-states.json` 최신 유지
3. **hourly-data 갱신**: 새 시간대 데이터 양쪽 반영 필요

---

_분석 완료: 2026-02-06_
