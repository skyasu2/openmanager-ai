# Grafana Cloud vs OpenManager AI - 데이터 파이프라인 비교 분석

> Owner: platform-data
> Status: Active Supporting
> Doc type: Explanation
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/data/data-architecture.md
> Tags: grafana,comparison,architecture,data-pipeline

**작성일**: 2026-02-16
**프로젝트 버전**: v8.0.0

---

## 1. 데이터 수집 (Collection)

### Grafana Cloud

**에이전트**: Grafana Alloy (구 Grafana Agent)

**프로토콜**:
- **Prometheus Scrape**: 전통적인 pull 방식으로 `/metrics` 엔드포인트에서 메트릭 수집
- **OTLP Push**: OpenTelemetry Protocol (gRPC/HTTP) 통한 푸시 방식
- **하이브리드 지원**: 100% OTLP 호환 + 네이티브 Prometheus 기능

**특징**:
- Grafana Alloy는 OpenTelemetry Collector 배포판
- 컴포넌트 기반 파이프라인 구성 (수집 → 변환 → 전송)
- 로그(Promtail 파이프라인), 메트릭, 트레이스, 프로파일링 통합 지원

**데이터 소스**:
```
실제 서버 → Node Exporter / OTLP SDK → Grafana Alloy (scrape/push)
```

### OpenManager AI

**시뮬레이션 방식**: 실제 에이전트 없음

**데이터 소스**:
- **OTel-native JSON 파일**: `public/data/otel-data/hourly/hour-XX.json` (24개)
- **사전 계산된 시나리오**: 5개 장애 시나리오 (DB 과부하, 네트워크 병목, 캐시 OOM 등)
- **15대 온프레미스 서버** 가상 환경

**생성 방식**:
```typescript
// scripts/data/otel-fix.ts - OTel Standard Format 생성
// 시나리오별 메트릭 패턴을 시간대별 JSON으로 사전 계산
npm run data:fix  // 데이터 보정
npm run data:verify  // 무결성 검증
```

**특징**:
- 결정론적 데이터 (랜덤 생성 금지)
- OTel Standard Format 준수 (ExportMetricsServiceRequest)
- Git 버전 관리로 재현 가능한 장애 시뮬레이션

---

## 2. 데이터 전송 (Transmission)

### Grafana Cloud

**프로토콜**: Prometheus Remote Write v1/v2

**구조**:
```
Grafana Alloy → prometheus.remote_write → Grafana Cloud Mimir
                 (WAL 포함)
```

**최적화**:
- **Write-Ahead Log (WAL)**: 네트워크 장애 시 로컬 버퍼링
- **Remote Write v2**: 네트워크 비용 최대 50% 절감 (중복 메타데이터 압축)
- **배치 전송**: 여러 샘플을 묶어 전송

**OTLP 경로**:
```
OTLP SDK → otelcol.exporter.prometheus → prometheus.remote_write → Mimir
```

### OpenManager AI

**전송 없음**: 파일 기반 로컬 데이터

**Vercel (Frontend)**:
```typescript
// src/services/metrics/MetricsProvider.ts - Singleton 패턴
import { MetricsProvider } from '@/services/metrics/MetricsProvider';
const provider = MetricsProvider.getInstance();
await provider.ensureDataLoaded(hour); // public/data 기반 async 로딩
const metrics = await provider.getAllServerMetrics();
```

**Cloud Run (AI Engine)**:
```typescript
// cloud-run/ai-engine/data/otel-data/hourly/hour-12.json
const hourlyData = JSON.parse(fs.readFileSync('data/otel-data/hourly/hour-12.json'));
```

**특징**:
- Zero-Internal-Traffic Strategy (API 호출 없음)
- Direct File Access (번들/파일시스템)
- 네트워크 오버헤드 제거

---

## 3. 데이터 저장 (Storage)

### Grafana Cloud

**LGTM Stack 아키텍처**:

| 컴포넌트 | 용도 | 스토리지 형태 |
|---------|------|--------------|
| **Grafana Mimir** | 메트릭 (시계열) | Prometheus TSDB → 온디스크 블록 → 오브젝트 스토리지 (S3/GCS/Azure Blob) |
| **Grafana Loki** | 로그 (집계) | Index(라벨 목차) + Chunks(로그 본문) → 오브젝트 스토리지 |
| **Grafana Tempo** | 트레이스 (분산 추적) | 오브젝트 스토리지 전용 (Jaeger/Zipkin/OTLP 지원) |
| **Prometheus** | 로컬 TSDB | 로컬 메트릭 (LGTM 스택에 전송) |

**Mimir 특징**:
- 수평 확장 가능한 Prometheus 장기 보관
- 높은 카디널리티(cardinality) 처리
- 텐트별(tenant) TSDB 격리

**Loki 특징**:
- 로그를 라벨 기반으로 색인 (전체 텍스트 색인 없음)
- Chunks: 특정 라벨 세트의 로그 엔트리 컨테이너
- 비용 효율적 (Elasticsearch 대비 1/10 스토리지)

### OpenManager AI

**파일 기반 SSOT**:

```
public/data/otel-data/  (OTel-native Runtime SSOT)
├── hourly/
│   ├── hour-00.json ~ hour-23.json  (24개)
│   └── ExportMetricsServiceRequest 포맷
├── resource-catalog.json  (서버 메타데이터)
└── timeseries.json  (24시간 집계 시계열)
```

**특징**:
- **파일 = 데이터베이스**: JSON 파일이 TSDB 역할
- **Git 버전 관리**: 모든 데이터 변경 추적 가능
- **정적 데이터셋**: 동적 수집 없음, 시뮬레이션 중심
- **Supabase (보조)**: RAG용 로그 데이터만 PostgreSQL에 저장

---

## 4. 쿼리 및 시각화 (Query & Visualization)

### Grafana Cloud

**쿼리 언어**:
- **PromQL**: 메트릭 쿼리 (Prometheus Query Language)
- **LogQL**: 로그 쿼리 (Loki Query Language)

**PromQL 예시**:
```promql
# CPU 사용률 5분 평균
rate(node_cpu_seconds_total[5m]) * 100

# 메트릭 셀렉터 + 집계 함수
sum(rate(http_requests_total[5m])) by (status_code)
```

**LogQL 예시**:
```logql
# 라벨 기반 로그 선택
{job="nginx"} |= "error"

# 로그 → 메트릭 변환
rate({app="api"}[5m]) | json | line_format "{{.level}}"
```

**시각화**:
- Grafana Dashboard: 패널 기반 대시보드
- Query Builder: GUI로 PromQL/LogQL 생성
- Grafana Explore: 임시 쿼리 및 분석

**기능**:
- 실시간 알림 (Grafana Alerting)
- 통합 대시보드 (메트릭 + 로그 + 트레이스 상관관계)
- 템플릿 변수, 다이나믹 필터

### OpenManager AI

**쿼리 방식**: TypeScript 함수 (프로그래매틱)

**메트릭 조회 예시**:
```typescript
// src/services/metrics/MetricsProvider.ts
const provider = MetricsProvider.getInstance();

// 단일 서버 메트릭
const metrics = provider.getServerMetrics('web-nginx-dc1-01');

// 전체 서버 메트릭
const allMetrics = provider.getAllServerMetrics();

// 시스템 요약
const summary = provider.getSystemSummary();
```

**로그 조회 예시**:
```typescript
// src/services/server-data/server-data-logs.ts
import { getLokiLogs } from '@/services/metrics/loki-logs';

// LogQL-like 필터링 (JSON 기반)
const logs = await getLokiLogs({
  serverId: 'db-mysql-dc1-primary',
  severity: ['error', 'warning'],
  limit: 100
});
```

**시각화**:
- **React 컴포넌트**: `src/components/dashboard/`
- **차트 라이브러리**: Recharts
- **실시간 폴링**: 1초 간격 메트릭 갱신 (KST 기준 시간 회전)

**알림 규칙**:
```json
// src/config/rules/system-rules.json
{
  "thresholds": {
    "cpu": { "warning": 80, "critical": 90 },
    "memory": { "warning": 80, "critical": 90 }
  },
  "statusRules": [
    {
      "name": "critical_cpu_memory",
      "condition": "CPU >= critical AND Memory >= critical",
      "resultStatus": "critical",
      "priority": 1,
      "for": "5m"
    }
  ]
}
```

**특징**:
- PromQL 없음, TypeScript 로직으로 집계/필터링
- JSON 규칙 기반 알림 (Grafana Alerting 대체)
- AI 챗봇 통합 (NLQ → 메트릭 조회)

---

## 5. Free Tier 제한

### Grafana Cloud Free Tier (2026)

| 항목 | 무료 한도 | 보관 기간 |
|------|----------|----------|
| **Active Metrics Series** | 10,000개 | 13개월 |
| **로그** | 50 GB/월 | 30일 |
| **트레이스** | 50 GB/월 | 30일 |
| **프로파일** | 포함 | 30일 |
| **사용자** | 3명 | - |
| **대시보드** | 무제한 | - |

**초과 시**: 자동으로 Pro 플랜 과금 시작 (추가 사용량 기준)

**출처**:
- [Grafana Pricing](https://grafana.com/pricing/)
- [Usage Limits](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/usage-limits/)

### OpenManager AI Free Tier

| 항목 | 비용 | 제한 |
|------|------|------|
| **Vercel Pro** | $20/월 | - |
| **Cloud Run** | Free Tier | vCPU 180K sec/월 (~50hr), Memory 360K GB-sec/월 (~200hr) |
| **Supabase** | Free Tier | Database 500MB, API 5만 req/월 |
| **데이터 스토리지** | $0 | Git 저장소 (GitHub) |
| **총 비용** | ~$20/월 | Vercel만 유료 |

**특징**:
- 데이터 수집 비용 없음 (시뮬레이션)
- 로그/메트릭 보관 제한 없음 (Git 버전 관리)
- Cloud Run Free Tier로 AI 엔진 운영

---

## 6. 비교 요약 (OpenManager AI vs Grafana Cloud)

### 데이터 수집

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 에이전트 | Grafana Alloy (실제 설치) | 없음 (시뮬레이션) |
| 프로토콜 | Prometheus scrape, OTLP push | N/A (파일 기반) |
| 대상 | 실서버, 컨테이너, 클라우드 | 가상 15대 서버 (JSON) |
| 실시간 | ✅ 실시간 수집 | ❌ 사전 계산 (24시간 고정) |
| 확장성 | 서버 추가 시 에이전트 설치 | JSON 편집 (scripts/data/otel-fix.ts) |

### 데이터 전송

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 프로토콜 | Prometheus Remote Write v2 | N/A (파일 로드) |
| 네트워크 | 인터넷 경유 (WAL 버퍼링) | 로컬/번들 (Zero Traffic) |
| 압축 | 메타데이터 압축 (v2) | 정적 파일 + fetch/fs 비동기 로딩 |
| 신뢰성 | WAL + 재전송 | Git 데이터 무결성 |

### 데이터 저장

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 메트릭 | Grafana Mimir (TSDB) | JSON 파일 (`public/data/otel-data`) |
| 로그 | Grafana Loki (Index+Chunks) | JSON 파일 + Supabase (RAG) |
| 트레이스 | Grafana Tempo (오브젝트 스토리지) | 미지원 |
| 스케일 | 수평 확장 (S3/GCS) | Git 저장소 (수 MB) |
| 보관 | 13개월 (메트릭), 30일 (로그) | 무제한 (Git) |
| 비용 | 무료 한도 초과 시 과금 | $0 (GitHub Free) |

### 쿼리 방식

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 쿼리 언어 | PromQL, LogQL | TypeScript 함수 |
| 집계 | `rate()`, `sum()`, `avg()` | Array.reduce, filter |
| 필터링 | 라벨 셀렉터 `{job="nginx"}` | JSON attribute 조건문 |
| Ad-hoc 쿼리 | Grafana Explore | AI 챗봇 (NLQ) |
| 학습 곡선 | PromQL 문법 학습 필요 | JavaScript/TypeScript 지식 |

### 시각화

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 대시보드 | Grafana Panel | React 컴포넌트 |
| 차트 | 내장 차트 (Time Series, Gauge 등) | Recharts 라이브러리 |
| 커스터마이징 | JSON 모델 + 플러그인 | 코드 수정 (full control) |
| 실시간 | WebSocket + 쿼리 | 1초 폴링 (rotating timestamp) |
| 템플릿 | 변수, 반복 패널 | Props, React children |

### 알림/규칙

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 규칙 엔진 | Grafana Alerting | JSON 규칙 (system-rules.json) |
| 조건 | PromQL 쿼리 기반 | JS 조건문 (threshold + duration) |
| 알림 채널 | Slack, PagerDuty, Email 등 | UI 모달, AI 챗봇 |
| 상태 관리 | 서버 사이드 (Alertmanager) | 클라이언트 사이드 (Zustand) |

---

## 7. 아키텍처 철학 차이

### Grafana Cloud: Production Observability

**목표**: 실제 프로덕션 시스템 모니터링

**특징**:
- 엔터프라이즈급 확장성 (수백만 메트릭 시리즈)
- 고가용성 (멀티 리전, 복제)
- 벤더 중립성 (OTLP, Prometheus, Graphite, InfluxDB 지원)
- 팀 협업 (RBAC, 조직 관리)

**적합 시나리오**:
- 클라우드 네이티브 애플리케이션
- 마이크로서비스 아키텍처
- 24/7 운영 환경
- SRE 팀 운영

### OpenManager AI: AI-Native Monitoring Platform

**목표**: AI 기반 서버 관리 데모 + 학습 플랫폼

**특징**:
- 결정론적 시뮬레이션 (재현 가능한 장애)
- AI 챗봇 중심 UX (NLQ → 메트릭 조회)
- Zero-Internal-Traffic (API 호출 최소화)
- Git 기반 데이터 관리 (버전 관리)

**적합 시나리오**:
- AI/ML 모니터링 PoC
- 교육용 데모
- 시뮬레이션 기반 테스트
- 비용 최소화 필요 시

---

## 8. 데이터 파이프라인 다이어그램 비교

### Grafana Cloud Pipeline

```
┌─────────────────┐
│  실제 서버       │
│  (Node Exporter) │
└────────┬────────┘
         │ Prometheus scrape / OTLP push
         ▼
┌─────────────────┐
│ Grafana Alloy   │  ← 수집 + 변환 + 필터링
│ (Agent)         │
└────────┬────────┘
         │ Prometheus Remote Write v2 (WAL)
         ▼
┌─────────────────────────────────────────┐
│  Grafana Cloud (LGTM Stack)             │
│  ┌──────────┬──────────┬──────────┐     │
│  │ Mimir    │ Loki     │ Tempo    │     │
│  │ (Metrics)│ (Logs)   │ (Traces) │     │
│  └──────────┴──────────┴──────────┘     │
│         │                                │
│         ▼                                │
│  Object Storage (S3/GCS/Azure)          │
└─────────────────┬───────────────────────┘
                  │ PromQL/LogQL
                  ▼
        ┌─────────────────┐
        │ Grafana         │  ← 시각화
        │ Dashboard       │
        └─────────────────┘
```

### OpenManager AI Pipeline

```
┌─────────────────────────────────────┐
│  scripts/data/otel-fix.ts           │  ← Build-Time 생성
│  (장애 시나리오 → OTel Standard)    │
└─────────────────┬───────────────────┘
                  │ npm run data:fix
                  ▼
┌─────────────────────────────────────┐
│  public/data/otel-data/             │  ← Runtime SSOT (Git)
│  ├── hourly/hour-XX.json (24개)     │
│  ├── resource-catalog.json          │
│  └── timeseries.json                │
└──────────┬──────────────┬───────────┘
           │ (동기화)     │
           ▼              ▼
   ┌──────────────┐  ┌───────────────────────┐
   │ Vercel       │  │ Cloud Run AI Engine   │
   │ (Frontend)   │  │ (Multi-Agent)         │
   └──────┬───────┘  └───────────┬───────────┘
          │ async fetch/fs       │ fs.readFileSync
          ▼                      ▼
   ┌──────────────────┐   ┌──────────────────┐
   │ MetricsProvider  │   │ Precomputed      │
   │ (Singleton)      │   │ States           │
   └──────┬───────────┘   └──────────────────┘
          │
          ▼
   ┌──────────────────┐
   │ React Dashboard  │  ← UI 시각화
   │ (Recharts)       │
   └──────────────────┘
```

---

## 9. 마이그레이션 시나리오

### OpenManager AI → Grafana Cloud 전환 시

**필요 작업**:

1. **에이전트 설치**:
   ```bash
   # Grafana Alloy 설치 (각 서버)
   curl -O https://raw.githubusercontent.com/grafana/alloy/main/install-linux.sh
   sudo bash install-linux.sh
   ```

2. **OTLP 수집 설정**:
   ```hcl
   // alloy config
   prometheus.scrape "default" {
     targets = [{"__address__" = "localhost:9090"}]
     forward_to = [prometheus.remote_write.cloud.receiver]
   }

   prometheus.remote_write "cloud" {
     endpoint {
       url = "https://prometheus-prod-01.grafana.net/api/prom/push"
       basic_auth {
         username = "12345"
         password = "YOUR_API_KEY"
       }
     }
   }
   ```

3. **대시보드 전환**:
   - React 컴포넌트 → Grafana Panel JSON
   - TypeScript 집계 로직 → PromQL 쿼리 변환

4. **알림 규칙 마이그레이션**:
   - `system-rules.json` → Grafana Alerting 규칙
   - Threshold + Duration → PromQL + for 절

**예시**:
```typescript
// OpenManager AI (TypeScript)
const cpuCritical = metrics.filter(m => m.cpu >= 90);

// Grafana Cloud (PromQL)
node_cpu_usage_percent > 90
```

### Grafana Cloud → OpenManager AI 전환 시

**필요 작업**:

1. **데이터 추출**:
   - Prometheus API로 과거 메트릭 쿼리
   - OTel Standard Format으로 변환
   - JSON 파일 생성 (hour-XX.json)

2. **규칙 변환**:
   - Grafana Alerting 규칙 → `system-rules.json`
   - PromQL → TypeScript 함수

3. **대시보드 재구현**:
   - Grafana Panel → React 컴포넌트
   - 차트 라이브러리 선택 (Recharts, Chart.js 등)

**한계**:
- 실시간 수집 불가 (시뮬레이션 전환)
- TSDB 질의 최적화 손실 (JSON 파일 스캔)
- 확장성 제한 (서버 수 증가 시 JSON 크기 증가)

---

## 10. 권장 사항

### Grafana Cloud 선택 시

✅ **추천**:
- 실제 프로덕션 시스템 모니터링 필요
- 수백 대 이상 서버 관리
- 팀 협업 및 RBAC 필요
- 기존 Prometheus/OTLP 인프라 보유
- 24/7 운영 환경

❌ **비추천**:
- PoC/데모 목적
- 비용 최소화 필요 (Free Tier 초과 시 과금)
- AI 중심 UX 필요
- 학습/교육 목적

### OpenManager AI 선택 시

✅ **추천**:
- AI 모니터링 PoC/데모
- 교육용 시뮬레이션 플랫폼
- 비용 최소화 (Free Tier 준수)
- Git 기반 데이터 관리 선호
- NLQ 기반 UX 실험

❌ **비추천**:
- 실제 프로덕션 모니터링
- 수백 대 이상 서버 관리
- 실시간 수집 필수
- 엔터프라이즈 확장성 필요
- 규제 준수 (감사 로그, 보안 인증)

---

## 11. 참고 자료

### Grafana Cloud 공식 문서

- [Grafana Cloud Metrics (Mimir)](https://grafana.com/products/cloud/metrics/)
- [Grafana Alloy Documentation](https://grafana.com/docs/alloy/latest/)
- [Prometheus Remote Write](https://grafana.com/docs/alloy/latest/reference/components/prometheus/prometheus.remote_write/)
- [LGTM Stack Architecture](https://grafana.com/docs/grafana-cloud/introduction/gs-visualize/)
- [Grafana Pricing](https://grafana.com/pricing/)
- [Usage Limits](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/usage-limits/)
- [PromQL Workflows](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/query-assistance/promql-workflows/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/query/)

### OpenManager AI 관련 문서

- [데이터 아키텍처 (SSOT)](./data-architecture.md)
- [OTel 데이터 아키텍처](./otel-data-architecture.md)
- [옵저버빌리티 가이드](../../../guides/observability.md)
- [시스템 아키텍처](../system/system-architecture-current.md)

---

_Last Updated: 2026-02-17_
