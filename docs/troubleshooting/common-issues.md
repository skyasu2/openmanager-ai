# Common Issues

> Last verified against code: 2026-02-13
> Status: Active Canonical

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

## Related

- [Troubleshooting Home](./README.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [API Endpoints](../reference/api/endpoints.md)
