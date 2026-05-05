# Troubleshooting Guide

> 공통 장애 대응 절차와 진입점을 제공하는 트러블슈팅 인덱스
> Owner: documentation
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-05-05
> Canonical: docs/troubleshooting/README.md
> Tags: troubleshooting,index,operations

## Available Docs

- [Common Issues](./common-issues.md)
- [Operations](../operations/README.md)
- [Deployment Guide](../operations/deployment-guide.md)
- [Rollback Guide](../operations/rollback-guide.md)

## First Response Checklist

```bash
npm run type-check
npm run lint
npm run test:quick
npm run docs:check
```

## Triage Route

| 증상 | 먼저 볼 문서 |
|---|---|
| 배포 직후 production 이상 | [Rollback Guide](../operations/rollback-guide.md) |
| GitLab runner, protected tag, deploy variable 문제 | [Common Issues](./common-issues.md#gitlab-ci-runner-executor-transition), [Deployment Guide](../operations/deployment-guide.md) |
| API 문서와 실제 route 불일치 | [API Endpoints](../reference/api/endpoints.md), `npm run docs:api:endpoints:check` |
| AI 응답 지연/실패 | [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md), [Observability](../guides/observability.md) |
| health check 호출 기준 혼선 | [Health Check Policy](../guides/standards/health-check-policy.md) |

## Scope

- 이 섹션은 현재 코드베이스 기준의 일반 장애 대응만 다룹니다.
- 과거 특정 시점 복구 문서는 별도 Historical 문서로 보존됩니다.

## Related

- [Development](../development/README.md)
- [Operations](../operations/README.md)
- [Reference](../reference/README.md)
- [Docs Home](../README.md)
