# 배포 가이드

> OpenManager production 배포 절차 runbook
> Owner: platform-devops
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-05-13
> Canonical: docs/operations/deployment-guide.md
> Tags: operations,deployment,gitlab,vercel,cloud-run

---

## 기준

Production deploy 권위는 GitLab CI semver tag pipeline입니다. Frontend는 Vercel production, AI Engine은 Cloud Run production으로 배포합니다. GitHub public remote는 frontend-only public snapshot이며 배포 source가 아닙니다.

| 대상 | 활성 경로 |
|---|---|
| Frontend | GitLab CI `deploy` job → `vercel build --prod` → `vercel deploy --prebuilt --prod` |
| AI Engine | GitLab CI `deploy_ai_engine` job → `cloud-run/ai-engine/deploy.sh` |
| Public snapshot | `npm run sync:github`으로 frontend/public assets only 동기화. 직접 `git push origin/github-public` 금지 |

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
| runner | `wsl2-docker` self-hosted runner/Docker 가용성 확인. 실제 pipeline 생성/배정은 push 후 별도 확인 |
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

`status=created|pending|running|waiting_for_resource` 또는 `note=pipeline_not_terminal_after_wait`로 남으면 pipeline/job/resource queue를 확인합니다.

```bash
npm run gitlab:pipeline:inspect -- --pipeline <id>
```

`waiting_for_resource`는 runner 장애로 단정하지 말고 production `resource_group` 점유 여부를 먼저 확인합니다.

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

## Runner 장애 시 대응

runner가 내려가 있으면 production 배포를 직접 우회하지 않고 runner를 복구합니다.

```bash
npm run ci:runner:health
npm run gitlab:pipeline:inspect -- --pipeline <id>
```

복구 후에는 기존 pending job을 이어서 실행하거나 failed job을 retry합니다. 같은 semver tag를 다시 push해도 새 pipeline이 생성되지 않으므로 기존 tag pipeline의 job 상태를 기준으로 처리합니다.

## 관련 문서

- [CI/CD Reference](../development/ci-cd.md)
- [Rollback Guide](./rollback-guide.md)
- [Deployment Architecture](../architecture/03-deployment-architecture.md)
- [Health Check Policy](../guides/standards/health-check-policy.md)
- [AI Standards](../guides/ai/ai-standards.md)
