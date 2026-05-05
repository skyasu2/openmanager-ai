# 운영 문서 허브

> 로컬 개발, 배포, 장애 대응, QA evidence 운영 문서의 입구
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/operations/README.md
> Tags: operations,deployment,qa,troubleshooting

---

## 문서 위치

운영 절차의 상세 문서는 기존 개발/트러블슈팅 문서를 SSOT로 유지합니다.

| 영역 | 문서 |
|---|---|
| 로컬 개발 환경 | [Project Setup](../development/project-setup.md) |
| 환경변수 | [Environment Variables](../development/environment-variables.md) |
| CI/CD와 배포 권위 | [CI/CD](../development/ci-cd.md) |
| Production 배포 절차 | [Deployment Guide](./deployment-guide.md) |
| Rollback 판단/실행 | [Rollback Guide](./rollback-guide.md) |
| Docker/Cloud Run 로컬 실행 | [Docker](../development/docker.md) |
| Git hooks | [Git Hooks Workflow](../development/git-hooks-workflow.md) |
| 테스트 전략 | [Test Strategy](../guides/testing/test-strategy.md) |
| QA evidence 기록 | `reports/qa/qa-tracker.json`, `npm run qa:record`, [QA Status](../../reports/qa/QA_STATUS.md) |
| 공통 문제 해결 | [Common Issues](../troubleshooting/common-issues.md) |
| 배포/운영 아키텍처 | [Deployment Architecture](../architecture/03-deployment-architecture.md) |
| Health check 정책 | [Health Check Policy](../guides/standards/health-check-policy.md) |

## 운영 루프

| 상황 | 확인 순서 |
|---|---|
| 로컬 개발 시작 | `project-setup` → `environment-variables` → `npm run dev:stable` |
| 배포 준비 | `type-check`/`lint`/`test:quick`/`test:contract` → GitLab CI validate |
| 릴리즈 배포 | [Deployment Guide](./deployment-guide.md) → runner 상태 확인 → semver tag pipeline → frontend/AI smoke |
| 실환경 QA | Vercel production + Playwright MCP → `reports/qa` 기록 |
| 장애 진단 | `/api/health`, Cloud Run `/health`, Vercel usage, logs/evidence 확인 |
| 롤백 판단 | [Rollback Guide](./rollback-guide.md) → GitLab/Vercel/Cloud Run의 직전 정상 배포와 QA evidence 기준 |

## AI 작업용 빠른 참조

운영 관련 질문은 아래 순서로 근거를 모읍니다. 이 문서는 절차 허브이고, 상세 SSOT는 기존 개발/가이드/QA 문서에 남겨 둡니다.

| 질문 | 먼저 확인할 문서 | 판단 기준 |
|---|---|---|
| 지금 배포 권위와 remote 기준은 무엇인가 | [Deployment Guide](./deployment-guide.md), [CI/CD](../development/ci-cd.md), [AI Standards](../guides/ai/ai-standards.md) | GitLab CI가 production deploy 권위, GitHub public은 snapshot |
| 실환경 QA를 어떻게 기록하는가 | [QA Status](../../reports/qa/QA_STATUS.md), `reports/qa/qa-tracker.json` | 실행 결과는 QA tracker와 evidence 파일로 남김 |
| health check는 언제 실제 외부 서비스를 호출해도 되는가 | [Health Check Policy](../guides/standards/health-check-policy.md) | 기본은 deterministic/local, release gate에서만 실환경 smoke 허용 |
| 장애 원인을 어디서부터 좁히는가 | [Rollback Guide](./rollback-guide.md), [Common Issues](../troubleshooting/common-issues.md), [Deployment Architecture](../architecture/03-deployment-architecture.md) | Vercel BFF, Cloud Run AI Engine, Redis/Cloud Tasks, Supabase 경계를 분리 |
| 비용/쿼터 때문에 설계를 바꿔도 되는가 | [Free Tier Optimization](../reference/architecture/infrastructure/free-tier-optimization.md), [ADR](../adr/README.md) | 스펙 증설보다 routing/fallback/cache/queue 조정 우선 |

## 운영 원칙

- production deploy 권위는 GitLab CI입니다.
- GitHub public remote는 공개 snapshot이며 직접 push하지 않습니다.
- 배포/QA 후 `/api/health`, Cloud Run `/health`, Vercel usage, QA evidence를 확인합니다.
- 장애 대응은 비용 증설보다 원인 파악, fallback, deterministic recovery, cache/queue 조정부터 검토합니다.
