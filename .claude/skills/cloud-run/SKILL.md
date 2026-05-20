---
name: cloud-run
description: Cloud Run deploy, cost check, and rollback for the AI Engine service. GitLab CI deploy_ai_engine is the production deploy authority; direct deploy.sh is fallback only.
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# Cloud Run

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Cloud Run 배포와 GCP 비용 점검을 수행합니다. Production 배포 권한은 GitLab CI `deploy_ai_engine`가 가지며, 직접 `deploy.sh` 실행은 명시 요청, runner 장애, 긴급 복구 시 fallback으로만 사용합니다.

## Trigger Keywords

- "/cloud-run", "/deploy", "/gcp-cost-check"
- "배포", "ai engine 배포"
- "비용 확인", "billing", "free tier"

## Workflow A: Deploy

1. 배포 경로 선택.
- 기본 production 경로: 커밋된 변경 → `git-workflow` → `git push gitlab ...` → GitLab CI `deploy_ai_engine`
- 배포 전 runner 확인: `bash scripts/ci/runner-health-check.sh`
- runner 장애 또는 명시적 수동 배포 요청이면 `deploy.sh` fallback을 허용하되, 결과 보고에 "CI gate skipped"를 명시

1. 사전 점검.
- `git status --short`
- `gcloud config get-value project`
- `cd cloud-run/ai-engine && npm run type-check`
- 필요 시 Docker 준비 확인: `docker ps`

1. 로컬 빌드 선검증.
- `cd cloud-run/ai-engine && npm run docker:preflight`
- 실패 시 배포 중단 후 원인 해결

1. 비용 리스크 가드 확인.
- `rg -n "machineType|--machine-type|E2_HIGHCPU_8|N1_HIGHCPU_8" cloud-run/ai-engine/deploy.sh cloud-run/ai-engine/cloudbuild.yaml`
- 위험 설정이 있으면 중단 후 수정

1. 배포 실행.
- CI 경로: `git-workflow`로 GitLab push 후 `npm run gitlab:pipeline:head -- --wait`로 pushed `HEAD` pipeline 확인
- Production release/tag 경로: 준비된 semver tag가 있으면 `git push gitlab --follow-tags`
- 수동 fallback: `cd cloud-run/ai-engine && bash deploy.sh`

1. 배포 후 검증.
- `SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')`
- `curl -s "$SERVICE_URL/health"` (인증 불필요, `status: "ok"` 확인)
- `curl -s -H "X-API-Key: $CLOUD_RUN_API_SECRET" "$SERVICE_URL/monitoring"` (인증 필요, agents 7개 활성 확인)

1. 결과 보고.
- deploy path (`gitlab-ci` | `manual-fallback`), pipeline id/status/url(가능 시), project, service URL, health/monitoring 결과, 가드 체크 결과, 롤백 명령

## Workflow B: Cost Check

1. 인증/프로젝트 확인.
- `gcloud auth list`
- `gcloud config get-value project`

1. Cloud Build 머신 설정 확인.
- `gcloud builds list --limit=30 --format="table(id.slice(0:8),status,createTime.date(),options.machineType)"`
- `options.machineType`가 비어있지 않거나 고사양 값이면 경고

1. 유료 시그널 탐지.
- `gcloud builds list --limit=200 --format=json > /tmp/gcp-builds.json`
- `E2_HIGHCPU_8`, `N1_HIGHCPU_8`, 기타 커스텀 machineType 존재 여부 확인

1. Cloud Run 리소스 한도 확인.
- `gcloud run services describe ai-engine --region asia-northeast1 --format="value(spec.template.spec.containers[0].resources.limits)"`
- CPU/Memory가 팀 기준선을 벗어나면 경고

1. 상태 분류.
- `FREE_TIER_OK`: 유료 시그널 없음, 리소스 한도 적정
- `COST_WARNING`: 유료 시그널 존재 또는 리소스 과다

1. 조치안 보고.
- 수정이 필요한 파일/설정
- 배포 진행 가능 여부(continue/block)

## Failure Handling

- Docker/GCP 인증 문제면 원인 로그와 함께 중단
- health 실패 시 10~20초 후 1회 재검증
- manual fallback을 사용하면 CI gate가 생략됐음을 명시
- 회귀 확인 시 즉시 롤백 경로 안내

## Output Format

### Deploy
```text
Cloud Run Deploy Results
- deploy path: gitlab-ci | manual-fallback
- project: <id>
- service URL: <url>
- health: ok|fail
- monitoring: ok|fail
- pipeline: <id/status/url | not_checked | skipped>
- cost guard: pass|warn
- rollback: gcloud run services update-traffic ...
```

### Cost Check
```text
GCP Cost Check Results
- project: <id>
- cloud build paid-signal: yes|no
- cloud run limits: <value>
- status: FREE_TIER_OK|COST_WARNING
- next action: <one line>
```

## References

- `references/edge-cases.md`
- `references/rollback.md`

## Related Skills

- `git-workflow` - 배포 전 커밋/푸시
- `lint-smoke` - 배포 전 품질 검증

## Changelog

- 2026-04-25: v2.0.0 - GitLab CI deploy_ai_engine 권위 반영, runner health 및 pipeline 확인 추가
- 2026-02-17: v1.0.0 - cloud-run-deploy + gcp-cost-check 병합 통합
