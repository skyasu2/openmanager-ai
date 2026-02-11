# 서버 데이터 아키텍처 가이드

**최종 업데이트**: 2026-02-08
**프로젝트 버전**: v7.1.4

---

## 🎯 설계 의도: Zero-Internal-Traffic Strategy

### 왜 이 아키텍처인가?

AI/ML 서비스가 단순히 API를 호출하는 비효율적인 구조를 탈피하고, 각 서비스의 특성에 맞는 **최적의 데이터 접근 경로**를 구축했습니다.

- **Vercel API**: 오직 **외부 클라이언트(User Interface)**의 요청만 처리
- **Internal Services**: API를 거치지 않고 **Direct Access (File/DB/Memory)** 사용

### 🚀 Optimized Data Flow

| Service | Data Source | Access Method |
|---------|-------------|---------------|
| **OTel Processor** | `src/data/otel-processed/*.json` | Primary Load |
| **Dashboard UI** | `src/data/fixed-24h-metrics.ts` | Fallback Import |
| **AI Engine** | `cloud-run/ai-engine/data/hourly-data/*.json` | File Load |
| **RAG System** | Supabase `server_logs` | DB Query |

---

## 🏛️ SSOT (Single Source of Truth) 아키텍처

### 데이터 흐름 (3-Tier Priority)

```
┌─────────────────────────────────┐
│  src/data/otel-processed/       │  ← 1. Primary (OTel Semantic Conv.)
│  (OpenTelemetry Processed Data) │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  src/data/hourly-data/          │  ← 2. Fallback (Prometheus Format)
│  (Bundle-included JSON)         │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  fixed-24h-metrics.ts           │  ← 3. Last Resort (Code-level)
│  (Baseline Fallback)            │
└─────────────────────────────────┘
```

### 동기화 명령어

```bash
# SSOT에서 hourly-data 및 OTel 처리 데이터 동기화
npm run data:sync

# 출력:
#   - src/data/hourly-data/hour-XX.json (24개, SSOT 번들)
#   - src/data/otel-processed/hourly/hour-XX.json (24개, OTel 변환)
```

---

## 🖥️ 서버 구성 (15대 - Korean DC)

### 서버 목록

| 유형 | ID | 이름 | 위치 |
|------|-----|------|------|
| **Web** | `web-nginx-icn-01` | Nginx Web Server 01 | Seoul-ICN-AZ1 |
| **Web** | `web-nginx-icn-02` | Nginx Web Server 02 | Seoul-ICN-AZ2 |
| **Web** | `web-nginx-pus-01` | Nginx Web Server DR | Busan-PUS-AZ1 |
| **API** | `api-was-icn-01` | WAS API Server 01 | Seoul-ICN-AZ1 |
| **API** | `api-was-icn-02` | WAS API Server 02 | Seoul-ICN-AZ2 |
| **API** | `api-was-pus-01` | WAS API Server DR | Busan-PUS-AZ1 |
| **DB** | `db-mysql-icn-primary` | MySQL Primary | Seoul-ICN-AZ1 |
| **DB** | `db-mysql-icn-replica` | MySQL Replica | Seoul-ICN-AZ2 |
| **DB** | `db-mysql-pus-dr` | MySQL DR | Busan-PUS-AZ1 |
| **Cache** | `cache-redis-icn-01` | Redis Cache 01 | Seoul-ICN-AZ1 |
| **Cache** | `cache-redis-icn-02` | Redis Cache 02 | Seoul-ICN-AZ2 |
| **Storage** | `storage-nfs-icn-01` | NFS Storage | Seoul-ICN-AZ1 |
| **Storage** | `storage-s3gw-pus-01` | S3 Gateway DR | Busan-PUS-AZ1 |
| **LB** | `lb-haproxy-icn-01` | HAProxy LB 01 | Seoul-ICN-AZ1 |
| **LB** | `lb-haproxy-pus-01` | HAProxy LB DR | Busan-PUS-AZ1 |

### 서버 ID 명명 규칙

```
{type}-{software}-{region}-{number}

예시:
  web-nginx-icn-01
  │    │     │   └─ 서버 번호
  │    │     └───── 리전 (icn=인천/서울, pus=부산)
  │    └─────────── 소프트웨어 (nginx, mysql, redis 등)
  └──────────────── 타입 (web, api, db, cache, storage, lb)
```

---

## 🔴 장애 시나리오 (5개)

| 시간 | 시나리오 | 영향 서버 | 상태 |
|------|---------|----------|------|
| **02시** | DB 자동 백업 - 디스크 I/O 과부하 | `db-mysql-icn-primary`, `storage-nfs-icn-01` | Warning |
| **03시** | DB 슬로우 쿼리 누적 - 성능 저하 | `db-mysql-icn-primary` | Critical |
| **07시** | 네트워크 패킷 손실 - LB 과부하 | `lb-haproxy-icn-01`, `api-was-icn-01/02` | Critical |
| **12시** | Redis 캐시 메모리 누수 - OOM 직전 | `cache-redis-icn-01`, `cache-redis-icn-02` | Critical |
| **21시** | API 요청 폭증 - CPU 과부하 | `api-was-icn-01/02`, `web-nginx-icn-01/02` | Critical |

---

## 📁 데이터 파일 구조

### Active Files (삭제 금지)

| 파일 경로 | 용도 | 수정 가능 |
|-----------|------|----------|
| `src/data/otel-processed/*.json` | **Primary (OTel Data)** | ❌ 자동 생성 (data:otel) |
| `src/data/hourly-data/*.json` | **Secondary (Prometheus)** | ❌ 자동 생성 (data:sync) |
| `src/data/fixed-24h-metrics.ts` | **Tertiary (Fallback)** | ✅ 핵심 로직 |
| `scripts/data/sync-hourly-data.ts` | JSON 데이터 생성 스크립트 | ✅ 수정 가능 |
| `cloud-run/ai-engine/data/hourly-data/*.json` | AI Engine용 데이터 | ❌ 자동 생성 |

### 파일 크기

```
public/hourly-data/
├── hour-00.json ~ hour-23.json
├── 파일당 크기: ~124KB
├── 총 24개 파일
└── 총 크기: ~3MB
```

---

## 📝 새로운 기능 추가 시 체크리스트

### 서버 추가/수정 시

- [ ] **1단계**: `scripts/data/sync-hourly-data.ts`의 `KOREAN_DC_SERVERS` 배열 수정
- [ ] **2단계**: `npm run data:sync` 실행
- [ ] **3단계**: 생성된 JSON 파일 Git 커밋
- [ ] **4단계**: `src/data/fixed-24h-metrics.ts` 동기화 확인

### 장애 시나리오 추가/수정 시

- [ ] **1단계**: `scripts/data/sync-hourly-data.ts`의 `FAILURE_SCENARIOS` 배열 수정
- [ ] **2단계**: `npm run data:sync` 실행
- [ ] **3단계**: 생성된 JSON 파일 Git 커밋

---

## 🎯 핵심 원칙

### ❌ 금지 사항

```typescript
// ❌ 절대 금지: 실시간 랜덤 생성 (비결정론적)
const randomMetric = Math.random() * 100;

// ❌ 절대 금지: hourly-data JSON 직접 수정
// 항상 npm run data:sync로 생성
```

### ✅ 올바른 방법

```typescript
// ✅ Dashboard: SSOT에서 직접 import
import { getDataAtMinute } from '@/data/fixed-24h-metrics';

// ✅ AI Engine: JSON 파일 로드
const hourlyData = JSON.parse(fs.readFileSync('data/hourly-data/hour-12.json'));
```

---

## 📖 관련 문서

- **SSOT 상세**: `src/data/fixed-24h-metrics.ts`
- **Sync 스크립트**: `scripts/data/sync-hourly-data.ts`
- **시뮬레이션 가이드**: `docs/guides/simulation.md`
