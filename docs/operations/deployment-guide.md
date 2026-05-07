# Deployment Guide

> OpenManager production 배포 절차 runbook
> Owner: platform-devops
> Status: Active Canonical
> Doc type: Runbook
> Last reviewed: 2026-05-07
> Canonical: docs/operations/deployment-guide.md
> Tags: operations,deployment,gitlab,vercel,cloud-run

---

## 기준

Production deploy 권위는 GitLab CI semver tag pipeline입니다. Frontend는 Vercel production, AI Engine은 Cloud Run production으로 배포합니다. GitHub public remote는 frontend-only public snapshot이며 배포 source가 아닙니다.

| 대상 | 표준 경로 | 보조/예외 경로 |
|---|---|---|
| Frontend | GitLab CI `deploy` job → `vercel build --prod` → `vercel deploy --prebuilt --prod` | runner 장애 시 `npm run deploy:smart`의 `vercel --prod` fallback |
| AI Engine | GitLab CI `deploy_ai_engine` job → `cloud-run/ai-engine/deploy.sh` | 로컬 `gcloud` 인증 후 `cd cloud-run/ai-engine && bash deploy.sh` |
| Public snapshot | `npm run sync:github` | frontend/public assets only. 직접 `git push origin/github-public` 금지 |

## 배포 전 확인

```bash
git remote -v
npm run ci:runner:health
npm run git:verify:canonical
npm run gitlab:protection:check
```

| 확인 | 기준 |
|---|---|
| remote | canonical push/fetch 대상은 `gitlab` |
| runner | `wsl2-docker` self-hosted runner가 살아 있으면 GitLab CI 경로 사용 |
| protected tag | GitLab protected tag 패턴 `v*.*.*` 필요 |
| secrets | `VERCEL_TOKEN`, `GCP_SERVICE_KEY`, `GCP_PROJECT_ID`는 GitLab protected CI variables 기준 |

Docs/reports 전용 변경은 GitLab CI가 스킵될 수 있습니다. 코드, runtime, API, AI Engine 변경이 섞였으면 로컬 게이트를 먼저 실행합니다.

```bash
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
```

AI Engine 변경이 있으면 별도 게이트를 추가합니다.

```bash
cd cloud-run/ai-engine
npm run type-check
npm run test
```

## 표준 배포

1. 변경을 검증하고 canonical repo에 반영합니다.

```bash
git push gitlab main
```

1. `GITLAB_TOKEN`이 있으면 방금 pushed `HEAD` pipeline을 확인합니다.

```bash
npm run gitlab:pipeline:head -- --wait
```

1. release script로 semver tag를 만들고 GitLab에 tag를 함께 push합니다.

```bash
./scripts/release/publish.sh patch
git push --follow-tags gitlab main
```

1. GitLab tag pipeline에서 아래 job을 확인합니다.

| Job | 기대 |
|---|---|
| `deploy` | Vercel production deploy |
| `deploy_ai_engine` | Cloud Run AI Engine deploy |
| `post_deploy_smoke` | `/`, `/login`, `/api/version` 최소 smoke |
| `post_deploy_ai_engine_smoke` | `/health`, `/warmup`, `/monitoring` 최소 smoke |

## 배포 후 확인

```bash
npm run qa:status
npm run qa:evidence:audit
```

| 확인 | 기준 |
|---|---|
| Frontend version | `/api/version`이 기대 version/commit을 반환 |
| Frontend health | `/api/health`는 수동 또는 release gate에서만 확인 |
| AI Engine health | Cloud Run `/health`와 smoke 결과 확인 |
| QA evidence | 실환경 QA를 수행했다면 `reports/qa`에 기록 |
| 비용 | Vercel/GCP 사용량 급증이 없는지 확인 |

## Runner 장애 시 fallback

runner가 내려가 있으면 기본 대응은 runner 복구입니다. 긴급 배포가 필요할 때만 fallback을 사용합니다.

```bash
npm run deploy:smart
```

fallback은 CI 게이트를 우회하므로 최종 보고에 반드시 `CI gate skipped`를 명시합니다. AI Engine production 배포는 가능하면 GitLab CI 또는 `cloud-run/ai-engine/deploy.sh` 표준 경로를 사용합니다.

## 관련 문서

- [CI/CD Reference](../development/ci-cd.md)
- [Rollback Guide](./rollback-guide.md)
- [Deployment Architecture](../architecture/03-deployment-architecture.md)
- [Health Check Policy](../guides/standards/health-check-policy.md)
- [AI Standards](../guides/ai/ai-standards.md)
