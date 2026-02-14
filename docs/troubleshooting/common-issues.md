# Common Issues

> 자주 발생하는 빌드/API 문제의 증상별 해결 가이드
> Owner: documentation
> Last verified against code: 2026-02-13
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/troubleshooting/common-issues.md
> Tags: troubleshooting,issues,debugging

## Build and Type Errors

### Symptoms
- `npm run build` 실패
- TypeScript strict 오류

### Actions
```bash
npm run type-check
npm run lint
npm run test:quick
npm run build
```

## API Route Mismatch

### Symptoms
- 문서 엔드포인트와 실제 API가 다름

### Actions
```bash
find src/app/api -name 'route.ts' -o -name 'route.tsx' | wc -l
```
- API 기준 문서: `docs/reference/api/endpoints.md`
- 소스 오브 트루스: `src/app/api/**/route.ts*`

## Cloud Run Connectivity

### Symptoms
- `/api/ai/supervisor` 응답 지연/실패

### Actions
- `CLOUD_RUN_AI_URL` 환경변수 확인
- `src/app/api/ai/supervisor/route.ts`에서 프록시 에러 로그 확인
- `/api/ai/wake-up`로 cold-start 완화 확인

## Docs Link Breakage

### Symptoms
- 문서 내 링크 클릭 시 404

### Actions
```bash
npm run docs:check
```
- 상대 경로 링크 사용
- 존재하지 않는 문서는 제거하거나 canonical 문서로 대체

## Docker / Container Issues

> 상세: [Docker 개발 환경 가이드](../development/docker.md)

### `docker: command not found` (WSL)

Docker Desktop이 WSL Integration을 제공하지 않는 상태.

```
Docker Desktop → Settings → Resources → WSL Integration
→ Ubuntu-24.04: ON → Apply & Restart
```

### `docker compose up` 빌드 실패

```bash
# 캐시 무시하고 클린 빌드
docker compose build --no-cache
docker compose up

# 또는 전체 정리 후 재빌드
docker compose down --rmi local --volumes
docker compose up --build
```

### 포트 8080 충돌

```bash
# 8080 사용 중인 프로세스 확인
lsof -i :8080

# 다른 포트로 실행 (docker-compose.yml의 ports 수정 없이)
docker compose run --service-ports -p 9090:8080 ai-engine
```

### Container OOM (메모리 부족)

AI Engine은 512MB 제한. `NODE_OPTIONS` heap이 384MB로 설정되어 있어 정상 범위 내.

```bash
# 컨테이너 메모리 사용량 확인
docker stats ai-engine-local
```

OOM 반복 시 `docker-compose.yml`의 `deploy.resources.limits.memory`를 `768M`으로 임시 증가 가능 (프로덕션 Cloud Run은 512Mi 고정).

### `gcloud builds submit` 실패

```bash
# 인증 확인
gcloud auth list

# 프로젝트 설정 확인
gcloud config get-value project

# Artifact Registry 권한 확인
gcloud artifacts repositories list --location=asia-northeast1
```

> Cloud Build는 GCP 서버에서 Docker 빌드를 수행하므로 로컬 Docker 상태와 무관합니다.

## Langfuse Issues

> 상세: [Observability 가이드](../guides/observability.md)

### Langfuse 이벤트가 대시보드에 안 보임

1. **쿼터 초과 (자동 차단) 확인**
```bash
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring | jq '.langfuse'
# isDisabled: true → 월 45,000 이벤트 초과로 자동 차단됨
# → 다음 달 1일에 자동 리셋
```

1. **API 키 확인**
```bash
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring/traces
# 401/403 → LANGFUSE_SECRET_KEY 또는 LANGFUSE_PUBLIC_KEY 오류
```

1. **모듈 미설치** — Cloud Run 로그에서 `[Langfuse] Module not installed` 검색. 이 경우 no-op 모드로 동작하며 이벤트가 전송되지 않음.

### Langfuse 사용량 급증

- 기본 샘플링: 100% (사용량 낮아 안전하지만, 트래픽 급증 시 위험)
- 대응: `LANGFUSE_TEST_MODE` 환경변수 제거 확인, Cloud Run 로그에서 `⚠️ [Langfuse]` 경고 확인

## Sentry Issues

> 상세: [Observability 가이드](../guides/observability.md)

### Sentry에 에러가 안 보임

1. **개발 환경인지 확인** — Sentry는 `production`에서만 활성화됩니다.
```bash
curl http://localhost:3000/api/debug/sentry-test?action=info | jq '.sentry.enabled'
# false → 정상 (개발 환경)
```

1. **DSN 설정 확인**
```bash
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=info" | jq '.sentry.dsn'
# "configured" → 정상, "missing" → 환경변수 확인 (fallback DSN이 있으므로 보통 configured)
```

1. **테스트 에러 전송으로 확인**
```bash
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=error"
# → Sentry 대시보드에서 "Sentry Test Error" 확인 (1-2분 소요)
```

### Sentry Tunnel 오류

클라이언트 에러가 Sentry에 도달하지 않는 경우:
```bash
# Tunnel 엔드포인트 직접 확인
curl -X POST https://...vercel.app/api/sentry-tunnel
# → 400 Bad Request 면 정상 (빈 body)
# → 404 면 라우트 문제
```

## Related

- [Troubleshooting Home](./README.md)
- [Observability 가이드](../guides/observability.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [API Endpoints](../reference/api/endpoints.md)
