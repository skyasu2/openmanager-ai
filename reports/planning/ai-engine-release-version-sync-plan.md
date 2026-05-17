> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-17
> Tags: cloud-run, release, gitlab-ci, ai-engine

# Release Component Version Contract Plan

- 상태: Completed
- 작성일: 2026-05-17
- 완료일: 2026-05-17
- TODO.md 연결: Active Tasks > 릴리스 구성요소 버전 계약 정리

## 목표

최근 Vercel production AI Assistant smoke와 Cloud Run 직접 확인에서 기능 동작은 정상으로 확인됐다. 다만 Vercel frontend는 `8.11.165`이고 Cloud Run `/health`는 `8.11.161`로 남아 있었다.

이 차이를 무조건 장애로 보지 않는다. Frontend(Vercel)와 AI Engine(Cloud Run)은 서로 다른 구현체이고, 문서/프론트 전용 릴리스가 backend 구현체 버전을 강제로 올리거나 배포할 이유는 없다.

개선 목표는 버전 의미를 분리하는 것이다.

```text
overall release version  = GitLab semver tag / 제품 릴리스 식별자
frontend version         = Vercel/Next.js 구현체 버전
aiEngine version         = Cloud Run AI Engine 구현체 버전
```

현재 문제는 `overall/frontend/backend` 버전이 관측과 release tooling에서 혼용되어, 정상적인 component-version 차이를 배포 드리프트처럼 해석하게 만든 점이다.

## 범위

- 포함:
  - `/api/version`과 `/api/health?service=ai`가 구성요소 버전을 명확히 노출한다.
  - release script가 frontend/overall 릴리스마다 AI Engine package version을 무조건 bump하지 않는다.
  - AI Engine package version이 실제로 바뀐 semver tag에서는 Cloud Run deploy 대상으로 분류한다.
  - AI Engine post-deploy smoke는 tag version이 아니라 AI Engine expected version을 검증한다.
  - 배포 스펙은 기존 Free Tier 기준 `1 CPU / 512Mi`를 유지한다.
- 제외:
  - 현재 turn에서 수동 Cloud Run production deploy 수행.
  - AI Engine 런타임 기능 변경, provider 설정 변경, 리소스 증설.
  - 별도 UI 버전 페이지 신설.

## 계약 (Contract)

### 변경 대상 파일

- `scripts/ci/should-deploy-ai-engine.sh`
- `scripts/ci/ai-engine-post-deploy-smoke.sh`
- `scripts/release/version-and-tag.mjs`
- `src/app/api/version/route.ts`
- `src/app/api/health/route.ts`
- `src/lib/ai-proxy/proxy.ts`
- `tests/unit/ci/should-deploy-ai-engine.test.ts`
- `tests/unit/ci/ai-engine-post-deploy-smoke.test.ts`
- `tests/unit/dev/release-publish.test.ts`
- `tests/api/version-route.test.ts`
- `src/app/api/health/route.test.ts`

### 입출력 계약

| 대상 | 입력 | 출력 | 에러 케이스 |
|------|------|------|-------------|
| `/api/version` | Vercel runtime | `versions.overall`, `versions.frontend` | unknown fallback 유지 |
| `/api/health?service=ai` | Cloud Run health proxy | `version` 또는 `aiEngine.version` | Cloud Run 장애 시 기존 degraded/error 유지 |
| release script | frontend-only release | root package version만 bump, AI Engine package version 유지 | 이전 tag 확인 불가 시 안전하게 AI Engine 포함 |
| release script | AI Engine 구현체 변경 release | root + AI Engine package version bump | 명시 env로 강제 bump 가능 |
| `should-deploy-ai-engine.sh` | `CI_COMMIT_TAG=vX.Y.Z`, AI Engine package version-only diff | `decision=deploy` | base/head 확인 불가 시 기존처럼 deploy |
| `should-deploy-ai-engine.sh` | branch/MR, AI Engine package version-only diff | `decision=skip` | metadata 외 변경이 있으면 deploy |
| `ai-engine-post-deploy-smoke.sh` | `AI_ENGINE_EXPECTED_VERSION` | `/health.version` 일치 시 pass | version 불일치 시 fail |

### 테스트 시나리오

- [x] 시나리오 1: `/api/version`은 overall/frontend 버전을 분리해 반환한다.
- [x] 시나리오 2: `/api/health?service=ai`는 Cloud Run health version을 전달한다.
- [x] 시나리오 3: frontend-only release는 AI Engine package version을 유지한다.
- [x] 시나리오 4: AI Engine 구현체 변경 release는 AI Engine package version을 bump한다.
- [x] 시나리오 5: branch version-only metadata 변경은 기존처럼 deploy skip.
- [x] 시나리오 6: semver tag version-only metadata 변경은 deploy.
- [x] 시나리오 7: post-deploy smoke는 `/health.version`이 expected version과 같으면 pass.
- [x] 시나리오 8: post-deploy smoke는 `/health.version`이 expected version과 다르면 fail.

## Task 목록

- [x] T0 — failing test 작성: semver tag version-only 변경은 deploy가 되어야 함.
- [x] T1 — `should-deploy-ai-engine.sh` 수정: tag pipeline에서는 version-only metadata도 deploy.
- [x] T2 — 구성요소 버전 노출 계약 추가.
- [x] T3 — release script 분리 버전 정책 반영.
- [x] T4 — `ai-engine-post-deploy-smoke.sh` expected AI Engine version 검증 추가.
- [x] T5 — targeted tests 및 기본 검증 실행.
- [x] T6 — 다음 semver release/tag pipeline에서 component version 계약 재확인.

## T6 검증 결과

2026-05-17 KST, `RELEASE_BUMP_AI_ENGINE_VERSION=1 npm run release:publish:patch`로 `v8.11.166` semver tag pipeline을 실행했다.

```text
release commit  : 88c93213e chore(release): 8.11.166
tag pipeline    : 2531547712 success
frontend deploy : post_deploy_smoke success
ai-engine deploy: deploy_ai_engine success
ai-engine smoke : post_deploy_ai_engine_smoke success
```

핵심 로그:

```text
decision=deploy reason=ai_engine_version_metadata_release_tag files="cloud-run/ai-engine/package-lock.json cloud-run/ai-engine/package.json" tag=v8.11.166
App Version:8.11.166
Free-tier guardrails passed
```

실서비스 확인:

```text
Vercel /api/version: version=8.11.166, versions.overall=8.11.166, versions.frontend=8.11.166
Cloud Run /health: status=ok, service=ai-engine, version=8.11.166
```

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| T0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| T1~T2 | `fix(ci):` | 예 | 다음 semver tag에서 예 | 아니오 |
| T3~T4 | `test(qa):` | 선택 | 검증 결과에 따라 | 아니오 |

## 완료 기준

- [x] targeted CI unit tests 통과.
- [x] `git diff --check` 통과.
- [x] 다음 semver tag pipeline에서 `deploy_ai_engine`가 AI Engine version-only 변경을 skip하지 않는다.
- [x] Cloud Run `/health.version`이 AI Engine expected package version과 일치한다.
