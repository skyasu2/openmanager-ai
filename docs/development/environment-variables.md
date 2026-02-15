# 환경 변수 관리 가이드

> 전체 환경변수 맵, 설정 경로, 시크릿 관리 방법
> Owner: platform-devops
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-15
> Canonical: docs/development/environment-variables.md
> Tags: env,secrets,configuration,setup

## 개요

이 프로젝트는 **3개 배포 환경** × **2개 서비스**에 걸쳐 환경변수를 관리합니다.

```
┌──────────────┬──────────────────────────────────────┐
│              │  환경변수 저장소                        │
├──────────────┼──────────────────────────────────────┤
│ 로컬 개발     │ .env.local (Git 무시)                 │
│ Vercel Prod  │ Vercel Dashboard → Settings → Env    │
│ Cloud Run    │ GCP Secret Manager + deploy.sh       │
│ CI (Actions) │ GitHub Secrets                        │
└──────────────┴──────────────────────────────────────┘
```

### 설정 SSOT

- **Vercel (Frontend)**: `src/config/index.ts` — Zod 스키마 기반 검증, 기본값 내장
- **Cloud Run (AI Engine)**: `cloud-run/ai-engine/src/config/` — 실행 시 환경변수 파싱

---

## Part 1: Vercel Frontend 환경변수

### 필수 환경변수

| 변수 | 용도 | 기본값 | 예시 |
|------|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST API URL | — | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | — | `eyJhbGciOiJIUzI1NiI...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 관리자 키 (서버 전용) | — | `eyJhbGciOiJIUzI1NiI...` |

### 선택 환경변수 — 앱 설정

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_APP_NAME` | 앱 이름 | `OpenManager AI` |
| `NEXT_PUBLIC_APP_VERSION` | 앱 버전 | `package.json` 참조 |
| `NEXT_PUBLIC_APP_URL` | 앱 URL | `https://openmanager-ai.vercel.app` |
| `NEXT_PUBLIC_DEBUG` | 디버그 모드 | `false` |
| `PORT` | 서버 포트 | `3000` |
| `NODE_ENV` | 환경 | `development` |

### 선택 환경변수 — AI 설정

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `AI_RESPONSE_TIMEOUT` | AI 응답 타임아웃 (ms) | `30000` |
| `AI_MAX_TOKENS` | 최대 토큰 수 | `4000` |
| `AI_TEMPERATURE` | LLM temperature | `0.7` |
| `AI_MAX_CONTEXT_LENGTH` | 최대 컨텍스트 길이 | `8000` |
| `AI_ENABLE_CONTINUOUS_LEARNING` | 지속 학습 활성화 | `true` |
| `AI_ENABLE_PATTERN_ANALYSIS` | 패턴 분석 활성화 | `true` |
| `AI_ENABLE_PREDICTION` | 예측 활성화 | `true` |
| `CLOUD_RUN_AI_ENABLED` | Cloud Run AI 연동 | `true` |

### 선택 환경변수 — 데이터/캐시

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `SERVER_COUNT` | 시뮬레이션 서버 수 | `15` |
| `GENERATION_INTERVAL` | 데이터 생성 주기 (ms) | `5000` |
| `DATA_COLLECTION_INTERVAL` | 데이터 수집 주기 (ms) | 설정 참조 |
| `MEMORY_CACHE_ENABLED` | 메모리 캐시 활성화 | `true` |
| `MEMORY_CACHE_MAX_SIZE` | 캐시 최대 항목 수 | `1000` |
| `MEMORY_CACHE_TTL_SECONDS` | 캐시 TTL (초) | `300` |
| `DATABASE_ENABLE_MOCK_MODE` | DB 모의 모드 | `true` |
| `DATABASE_CONNECTION_TIMEOUT` | DB 연결 타임아웃 (ms) | `10000` |
| `DATABASE_QUERY_TIMEOUT` | DB 쿼리 타임아웃 (ms) | `30000` |

### 선택 환경변수 — Sentry

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `SENTRY_DSN` | Server-side DSN | fallback DSN 내장 |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side DSN | fallback DSN 내장 |
| `SENTRY_AUTH_TOKEN` | 소스맵 업로드 (비활성) | — |
| `SENTRY_ORG` | 조직명 | `om-4g` |
| `SENTRY_PROJECT` | 프로젝트명 | `javascript-nextjs` |

### 선택 환경변수 — Redis

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | — |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis 토큰 | — |

> Redis 환경변수가 없으면 InMemory 캐시로 자동 폴백됩니다.

### 빌드 전용

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `SKIP_ENV_VALIDATION` | 환경변수 검증 스킵 | `false` |
| `NEXT_TELEMETRY_DISABLED` | 텔레메트리 비활성화 | `1` |

---

## Part 2: Cloud Run AI Engine 환경변수

Cloud Run은 **GCP Secret Manager**에 JSON 형태로 시크릿을 저장하고, `deploy.sh`가 `--set-secrets` 플래그로 주입합니다.

### Secret Manager 매핑

```bash
--set-secrets "SUPABASE_CONFIG=supabase-config:latest,\
               AI_PROVIDERS_CONFIG=ai-providers-config:latest,\
               KV_CONFIG=kv-config:latest,\
               CLOUD_RUN_API_SECRET=cloud-run-api-secret:latest,\
               LANGFUSE_CONFIG=langfuse-config:latest"
```

| Secret Name | 환경변수 | JSON 내용 |
|-------------|---------|----------|
| `supabase-config` | `SUPABASE_CONFIG` | `url`, `anonKey`, `serviceRoleKey` |
| `ai-providers-config` | `AI_PROVIDERS_CONFIG` | `cerebras`, `groq`, `mistral`, `google`, `openrouter` API 키 |
| `kv-config` | `KV_CONFIG` | `upstashRedisRestUrl`, `upstashRedisRestToken` |
| `cloud-run-api-secret` | `CLOUD_RUN_API_SECRET` | API 인증 키 (단일 문자열) |
| `langfuse-config` | `LANGFUSE_CONFIG` | `secretKey`, `publicKey`, `baseUrl` |

### deploy.sh로 주입되는 일반 환경변수

```bash
--set-env-vars "NODE_ENV=production,\
                BUILD_SHA=${SHORT_SHA},\
                DEFAULT_ORIGIN=${DEFAULT_ORIGIN},\
                ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
```

### 로컬 개발용 (`cloud-run/ai-engine/.env`)

```bash
# AI Providers
CEREBRAS_API_KEY=csk-xxx
GROQ_API_KEY=gsk_xxx
MISTRAL_API_KEY=xxx
GOOGLE_AI_API_KEY=xxx
OPENROUTER_API_KEY=sk-or-v1-xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Langfuse
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# Cloud Run API
CLOUD_RUN_API_SECRET=your-secret-here

# CORS
DEFAULT_ORIGIN=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Part 3: GitHub Actions 시크릿

CI/CD 워크플로우에서 사용하는 GitHub Secrets:

| Secret | 용도 | 사용 워크플로우 |
|--------|------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | simple-deploy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 키 | simple-deploy |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 관리자 키 | simple-deploy |
| `SUPABASE_URL` | Supabase URL (keep-alive) | keep-alive |
| `SUPABASE_ANON_KEY` | Supabase 키 (keep-alive) | keep-alive |
| `GOOGLE_API_KEY` | Google AI 키 | prompt-eval |
| `GROQ_API_KEY` | Groq 키 | prompt-eval |
| `CRON_SECRET` | Cron 인증 | simple-deploy |

---

## Part 4: 설정 검증 (SSOT)

### Zod 스키마 기반 검증

`src/config/index.ts`에서 모든 환경변수를 Zod 스키마로 검증합니다:

```typescript
const envSchema = z.object({
  version: z.string().default(process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'),
  environment: z.nativeEnum(Environment).default('development'),
  port: z.number().default(3000),
  // ... 모든 환경변수에 기본값 제공
});
```

**핵심 원칙**: 모든 환경변수에 **안전한 기본값**이 있어 `.env.local` 없이도 개발/빌드 가능.

### SKIP_ENV_VALIDATION

CI/CD 환경에서는 환경변수가 없을 수 있으므로:
```bash
SKIP_ENV_VALIDATION=true npm run build
```

이 플래그가 `true`면 Zod 검증을 건너뛰고 기본값을 사용합니다.

---

## Part 5: 보안 규칙

### `.env` 파일 규칙

| 파일 | Git 추적 | 용도 |
|------|---------|------|
| `.env.local` | ❌ `.gitignore` | 로컬 개발 시크릿 |
| `.env.example` | ✅ 추적 | 환경변수 목록 (값 없음) |
| `cloud-run/ai-engine/.env` | ❌ `.gitignore` | AI Engine 로컬 시크릿 |

### 하드코딩 방지

CI에서 `check-hardcoded-secrets.js` 스크립트가 자동 실행되어 소스 코드에 시크릿이 하드코딩되는 것을 차단합니다:

```yaml
# ci-optimized.yml > security-scan
- name: Hardcoded Secrets Check
  run: node scripts/env/check-hardcoded-secrets.js
```

---

## 관련 문서

- [프로젝트 셋업](./project-setup.md) - `.env.local` 초기 설정
- [CI/CD 파이프라인](./ci-cd.md) - GitHub Secrets 사용
- [Docker 가이드](./docker.md) - Cloud Run 환경변수 주입
- [Observability 가이드](../guides/observability.md) - Langfuse/Sentry 환경변수 상세
- [보안 아키텍처](../reference/architecture/infrastructure/security.md)

_Last Updated: 2026-02-15_
