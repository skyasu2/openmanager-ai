# API Endpoints Documentation

**Last Updated**: 2026-01-18

## Overview

OpenManager Vibe v5 현재 **76개의 API 엔드포인트**를 제공합니다.

### 분류

- **AI/ML**: 16개 (AI 어시스턴트, ML 분석, RAG)
- **서버 관리**: 9개 (서버 메트릭, 상태 조회)
- **시스템**: 7개 (시스템 초기화, 최적화)
- **모니터링**: 5개 (성능, 메트릭, 알림, 건강도)
- **인증**: 4개 (Auth, CSRF)
- **데이터베이스**: 3개 (상태, 리셋, Read-only)
- **기타**: 33개 (테스트, 디버그, 캐시 등)

---

## 🤖 AI/ML APIs (15개)

### Production (Active) ✅

| Endpoint                         | Method    | Description                      | Auth | Status     |
| -------------------------------- | --------- | -------------------------------- | ---- | ---------- |
| `/api/ai/supervisor`             | POST      | LLM 멀티 에이전트 Supervisor (Vercel AI SDK) | ✅   | **Active** |
| `/api/ai/incident-report`        | POST, GET | 자동 장애 보고서 생성            | ✅   | **Active** |
| `/api/ai/intelligent-monitoring` | POST      | 지능형 모니터링 분석             | ✅   | **Active** |
| `/api/ai/rag/benchmark`          | GET       | RAG 벡터 검색 성능 벤치마크      | ✅   | **Active** |
| `/api/ai/raw-metrics`            | GET       | AI 분석용 순수 메트릭            | ✅   | **Active** |
| `/api/ai/insight-center`         | POST      | AI 인사이트 센터                 | ❌   | **Active** |
| `/api/ai/health`                 | GET       | AI 시스템 헬스 체크              | ❌   | **Active** |
| `/api/ai/status`                 | GET       | AI 상태 조회                     | ❌   | **Active** |
| `/api/ai/wake-up`                | POST      | Cloud Run AI 엔진 웜업           | ❌   | **Active** |
| `/api/ai/feedback`               | POST      | AI 응답 피드백 수집              | ❌   | **Active** |
| `/api/ai/approval`               | POST      | AI 작업 승인                     | ❌   | **Active** |
| `/api/ai/unified-stream`         | POST      | 통합 AI 스트리밍                 | ❌   | **Active** |

### Async Job APIs (신규) 🆕

| Endpoint                         | Method    | Description                      | Auth | Status     |
| -------------------------------- | --------- | -------------------------------- | ---- | ---------- |
| `/api/ai/jobs`                   | POST      | 비동기 AI Job 생성               | ❌   | **Active** |
| `/api/ai/jobs/[id]`              | GET       | Job 상태 조회                    | ❌   | **Active** |
| `/api/ai/jobs/[id]/progress`     | GET       | Job 진행률 조회                  | ❌   | **Active** |
| `/api/ai/jobs/[id]/stream`       | GET       | Job 결과 SSE 스트리밍            | ❌   | **Active** |

### Deprecated (Legacy) 🗑️

| Endpoint                     | Method    | Description               | Status         | Replacement      |
| ---------------------------- | --------- | ------------------------- | -------------- | ---------------- |
| `/api/ai/korean-nlp`         | POST      | 한국어 NLP (GCP)          | **410 Gone**   | `supervisor` |
| `/api/ai/thinking/stream-v2` | POST      | 레거시 Thinking Stream    | **Deprecated** | `supervisor` |
| `/api/ai/logging/stream`     | GET, POST | AI 로그 스트리밍 (Memory) | **Legacy**     | -                |

---

## 🖥️ Server Management APIs (9개)

### Core Endpoints ✅

| Endpoint                      | Method           | Description              | Auth | Cache |
| ----------------------------- | ---------------- | ------------------------ | ---- | ----- |
| `/api/servers/all`            | GET              | 모든 서버 목록 조회      | ✅   | 30s   |
| `/api/servers`                | GET              | 서버 목록 (리다이렉트)   | ✅   | -     |
| `/api/servers/[id]`           | GET, PUT, DELETE | 서버 상세 정보           | ✅   | -     |
| `/api/servers/[id]/processes` | GET              | 서버 프로세스 목록       | ❌   | -     |
| `/api/servers/realtime`       | GET              | 실시간 서버 메트릭 (SSE) | ❌   | -     |
| `/api/servers/cached`         | GET              | 캐시된 서버 데이터       | ❌   | 60s   |
| `/api/servers/next`           | POST             | 서버 생성/업데이트       | ❌   | -     |
| `/api/servers-unified`        | GET              | 통합 서버 데이터         | ❌   | -     |

### Mock/Testing 🧪

| Endpoint            | Method | Description      | Purpose     |
| ------------------- | ------ | ---------------- | ----------- |
| `/api/servers/mock` | GET    | Mock 서버 데이터 | Development |

---

## ⚙️ System APIs (7개)

| Endpoint                 | Method    | Description      | Auth | Status     |
| ------------------------ | --------- | ---------------- | ---- | ---------- |
| `/api/system/status`     | GET       | 시스템 전체 상태 | ❌   | **Active** |
| `/api/system/initialize` | POST      | 시스템 초기화    | ❌   | **Active** |
| `/api/system/start`      | POST      | 시스템 시작      | ❌   | **Active** |
| `/api/system/optimize`   | POST      | 시스템 최적화    | ❌   | **Active** |
| `/api/system/sync-data`  | POST      | 데이터 동기화    | ❌   | **Active** |
| `/api/system/unified`    | GET       | 통합 시스템 정보 | ❌   | **Active** |
| `/api/config/adaptive`   | GET, POST | 적응형 설정 관리 | ❌   | **Active** |

---

## 📊 Monitoring APIs (5개)

| Endpoint                   | Method | Description                          | Auth | Interval  |
| -------------------------- | ------ | ------------------------------------ | ---- | --------- |
| `/api/metrics`             | GET    | 시스템 메트릭 조회                   | ❌   | 5s        |
| `/api/monitoring/report`   | GET    | Health Score + Alerts + Aggregation  | ❌   | 30s       |
| `/api/performance/metrics` | GET    | 성능 메트릭                          | ❌   | -         |
| `/api/performance/history` | GET    | 성능 히스토리                        | ❌   | -         |
| `/api/alerts/stream`       | GET    | 알림 스트리밍 (SSE)                  | ❌   | Real-time |

---

## 🔐 Authentication APIs (4개)

| Endpoint                        | Method | Description      | Status          |
| ------------------------------- | ------ | ---------------- | --------------- |
| `/api/auth/test`                | GET    | 인증 테스트      | **Active**      |
| `/api/auth/debug`               | GET    | 인증 디버그 정보 | **Development** |
| `/api/auth/error`               | GET    | 인증 에러 핸들링 | **Active**      |
| `/api/auth/revoke-github-token` | POST   | GitHub 토큰 폐기 | **Active**      |

---

## 🗄️ Database APIs (3개)

| Endpoint                      | Method    | Description         | Status     |
| ----------------------------- | --------- | ------------------- | ---------- |
| `/api/database/status`        | GET       | DB 연결 상태 확인   | **Active** |
| `/api/database/reset-pool`    | POST      | DB 커넥션 풀 리셋   | **Active** |
| `/api/database/readonly-mode` | GET, POST | Read-only 모드 관리 | **Active** |

---

## 🧪 Development/Testing APIs (10개)

## 🧪 Development/Testing APIs (8개)

| Endpoint                     | Method | Description        | Purpose     |
| ---------------------------- | ------ | ------------------ | ----------- |
| `/api/test/timezone`         | GET    | 타임존 테스트      | Development |
| `/api/test/vercel-test-auth` | GET    | Vercel 인증 테스트 | Development |
| `/api/debug/env`             | GET    | 환경 변수 디버그   | Development |
| `/api/ab-test`               | GET    | A/B 테스트 플래그  | Development |
| `/api/simulate/data`         | POST   | 데이터 시뮬레이션  | Development |
| `/api/ping`                  | GET    | 서버 Ping          | Monitoring  |
| `/api/time`                  | GET    | 서버 시간          | Utility     |

---

## 🔧 Utility APIs (8개)

| Endpoint                     | Method | Description      | Cache |
| ---------------------------- | ------ | ---------------- | ----- |
| `/api/cache/stats`           | GET    | 캐시 통계        | -     |
| `/api/cache/optimize`        | POST   | 캐시 최적화      | -     |
| `/api/csrf-token`            | GET    | CSRF 토큰 발급   | -     |
| `/api/error-report`          | POST   | 에러 리포트 수집 | -     |
| `/api/logs`                  | GET    | 시스템 로그 조회 | -     |
| `/api/notes/setup`           | POST   | 노트 초기 설정   | -     |
| `/api/notifications/browser` | POST   | 브라우저 알림    | -     |
| `/api/health`                | GET    | 전체 헬스 체크   | -     |

---

## 📈 Analytics/Monitoring (5개)

| Endpoint                | Method | Description         | Purpose    |
| ----------------------- | ------ | ------------------- | ---------- |
| `/api/dashboard`        | GET    | 대시보드 데이터     | Active     |
| `/api/prediction`       | POST   | 예측 분석           | Active     |
| `/api/enterprise`       | GET    | 엔터프라이즈 메트릭 | Active     |
| `/api/web-vitals`       | POST   | Web Vitals 수집     | Monitoring |
| `/api/universal-vitals` | POST   | Universal Vitals    | Monitoring |

---

## 🚀 Vercel/Deployment (3개)

| Endpoint              | Method | Description        | Purpose    |
| --------------------- | ------ | ------------------ | ---------- |
| `/api/vercel-usage`   | GET    | Vercel 사용량 조회 | Monitoring |
| `/api/version`        | GET    | 앱 버전 정보       | Info       |
| `/api/version/status` | GET    | 버전 상태 체크     | Info       |

---

## 🔗 Realtime/Rules APIs (2개)

| Endpoint                | Method | Description            | Status     |
| ----------------------- | ------ | ---------------------- | ---------- |
| `/api/realtime/connect` | GET    | 실시간 연결 (SSE)      | **Active** |
| `/api/rules`            | GET    | 규칙 설정 조회         | **Active** |

---

## 🔒 Security (1개)

| Endpoint                   | Method | Description     | Purpose  |
| -------------------------- | ------ | --------------- | -------- |
| `/api/security/csp-report` | POST   | CSP 위반 리포트 | Security |

---

## 🧹 Maintenance (1개)

| Endpoint            | Method | Description      | Schedule |
| ------------------- | ------ | ---------------- | -------- |
| `/api/cron/cleanup` | GET    | 정기 클린업 작업 | Hourly   |

---

## 📊 요약

### Status Distribution

- **Active (Production)**: 42개 (54%)
- **Deprecated**: 8개 (10%)
- **Development/Testing**: 18개 (23%)
- **Legacy (Unused)**: 10개 (13%)

### Authentication Coverage

- **Protected (withAuth)**: 9개 (12%)
- **Public**: 69개 (88%)

### Recommendations

1. **API 정리**: Deprecated API 10개 제거 또는 410 Gone 처리
2. **인증 강화**: 중요 API 20개 추가 인증 적용 검토
3. **캐싱 최적화**: 서버 API 캐시 전략 표준화
4. **문서화**: OpenAPI/Swagger 스펙 자동 생성 고려

---

**Last Updated**: 2026-02-11
**Total Endpoints**: 75+
**Framework**: Next.js 16.1.1 App Router

## API 아키텍처

### 라우팅 구조
- RESTful 설계 원칙 준수
- 버전 관리: `/api/v1/`, `/api/v2/`
- 리소스 기반 URL 구조

### 스키마 검증
- Zod를 통한 런타임 타입 검증
- TypeScript 타입과 동기화
- 요청/응답 데이터 검증

### 검증 규칙
- 필수 필드 검증
- 데이터 타입 검증
- 비즈니스 로직 검증
- 보안 검증 (XSS, SQL Injection 방지)
