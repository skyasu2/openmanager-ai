# Rollback Guide

> OpenManager production rollback 판단과 실행 기준
> Owner: platform-devops
> Status: Active Canonical
> Doc type: Runbook
> Last reviewed: 2026-05-05
> Canonical: docs/operations/rollback-guide.md
> Tags: operations,rollback,incident,vercel,cloud-run

---

## 기준

Rollback은 "무조건 이전 버전으로 되돌리기"가 아니라, 현재 장애가 사용자 핵심 경로를 깨고 있고 hotfix보다 이전 정상 배포로 되돌리는 편이 빠를 때 선택합니다.

| 상황 | 기본 판단 |
|---|---|
| 로그인, 대시보드, 기본 AI 질의가 깨짐 | rollback 또는 긴급 hotfix 후보 |
| 특정 고급 AI 기능만 degraded | fallback/feature flag/hotfix 우선 |
| docs/reports/QA 기록만 문제 | rollback 불필요 |
| Cloud Run cold start 또는 recoverable health timeout | warmup/재시도/soft degraded 처리 우선 |
| provider quota/rate limit | provider fallback, routing intensity 조정 우선 |

## 판단 순서

1. 장애 범위를 분리합니다.

| 계층 | 확인 |
|---|---|
| Frontend/BFF | Vercel production, `/api/version`, `/api/health`, browser QA evidence |
| AI Engine | Cloud Run `/health`, `/warmup`, `/monitoring`, job/stream route |
| Data/Auth | Supabase auth/session, OTel static data, Redis job store |
| Deployment | GitLab tag pipeline, Vercel deployment, Cloud Run revision |

1. 직전 정상 근거를 찾습니다.

| 근거 | 위치 |
|---|---|
| QA tracker | `reports/qa/qa-tracker.json` |
| QA status | `reports/qa/QA_STATUS.md` |
| GitLab pipeline | semver tag pipeline deploy/smoke result |
| Vercel deployment | latest successful production deployment |
| Cloud Run revision | latest healthy revision |

1. hotfix가 더 나은지 비교합니다.

| Hotfix 우선 | Rollback 우선 |
|---|---|
| 단일 config/copy/UI guard 문제 | deploy 직후 핵심 경로가 광범위하게 실패 |
| deterministic fallback으로 막을 수 있음 | 데이터/계약 불일치로 여러 경로가 동시에 실패 |
| 실패 원인이 명확하고 테스트가 작음 | 원인 조사 시간이 길고 이전 버전 정상 근거가 명확 |

## Frontend rollback

Vercel production rollback은 Vercel의 직전 정상 deployment로 되돌리는 방식이 가장 직접적입니다. GitLab CI가 deploy 권위이므로, rollback 후에는 GitLab/Git tag 상태와 실제 Vercel production 상태가 일시적으로 어긋났음을 기록합니다.

실행 전 확인:

```bash
npm run qa:status
git remote -v
```

실행 후 확인:

```bash
npm run qa:record -- --input <json>
npm run qa:status
```

Rollback 후에는 다음 release에서 GitLab CI 표준 경로로 production 상태를 다시 수렴시킵니다.

## AI Engine rollback

Cloud Run은 revision 단위로 traffic을 이전 정상 revision에 돌릴 수 있습니다. 실행 전에는 직전 정상 revision과 현재 장애 revision을 구분합니다.

확인 기준:

```bash
gcloud run services describe ai-engine --region asia-northeast1
gcloud run revisions list --service ai-engine --region asia-northeast1
```

Rollback 후에는 최소 smoke만 수행합니다. 실 LLM 호출은 기본 검증에 포함하지 않습니다.

```bash
curl -sS <cloud-run-url>/health
curl -sS <cloud-run-url>/warmup
```

## 기록 원칙

Rollback 또는 hotfix를 선택하면 아래를 남깁니다.

| 항목 | 기록 위치 |
|---|---|
| 증상과 영향 범위 | `reports/qa` run 또는 planning note |
| 선택한 조치 | QA run notes 또는 TODO completed item |
| 직전 정상 근거 | QA tracker, GitLab pipeline, Vercel/Cloud Run revision |
| 후속 방지책 | 관련 design/reference 문서 또는 regression test |

## 관련 문서

- [Deployment Guide](./deployment-guide.md)
- [Operations](./README.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
- [Health Check Policy](../guides/standards/health-check-policy.md)
- [Free Tier Optimization](../reference/architecture/infrastructure/free-tier-optimization.md)
