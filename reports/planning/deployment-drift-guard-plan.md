> Owner: project
> Status: Approved
> Last reviewed: 2026-04-29

# Deployment Drift Guard Plan

- 상태: Approved
- 작성일: 2026-04-29
- TODO.md 연결: Active Tasks > Deployment drift guard and AI deploy skip

## 목표

Vercel production QA가 최신 GitLab main 변경이 아직 배포되지 않은 상태를 제품 회귀로 오판하지 않도록 배포 식별 정보를 노출하고, semver tag pipeline에서 AI Engine 변경이 없을 때 Cloud Run 재배포와 smoke를 생략한다.

## 범위

- 포함:
  - `/api/version`에 GitLab/Vercel 배포 식별 메타데이터 추가
  - Vercel post-deploy smoke가 release tag와 commit SHA를 검증하도록 확장
  - GitLab CI Vercel deploy 단계에 명시적 build/runtime metadata 전달
  - AI Engine 변경 없음 감지 시 `deploy_ai_engine`과 AI smoke를 no-op 처리
  - QA 실행 전 드리프트 판별에 재사용 가능한 스크립트 추가
- 제외:
  - Vercel Git Integration 재활성화
  - Cloud Run 리소스 증설 또는 always-on 설정
  - Playwright broad QA 자동 실행
  - public GitHub snapshot 동기화

## 계약 (Contract)

### 변경 대상 파일

- `src/app/api/version/route.ts`
- `tests/api/version-route.test.ts`
- `scripts/test/vercel-post-deploy-smoke.mjs`
- `tests/unit/qa/vercel-post-deploy-smoke.test.ts`
- `scripts/qa/check-vercel-deployment-drift.mjs`
- `tests/unit/qa/vercel-deployment-drift.test.ts`
- `scripts/ci/should-deploy-ai-engine.sh`
- `tests/unit/ci/should-deploy-ai-engine.test.ts`
- `.gitlab-ci.yml`
- `reports/planning/TODO.md`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `GET /api/version` | HTTP GET | JSON `{ version, buildVersion, nextjs, environment, timestamp, commitSha, shortCommitSha, releaseTag, pipelineUrl, deploymentProvider }` | 없음. 누락 env는 빈 문자열 또는 `unknown`으로 반환 |
| `vercel-post-deploy-smoke.mjs --expected-commit-sha=<sha>` | CLI args + `/api/version` JSON | exit `0` on match | commit mismatch 시 exit `1` |
| `check-vercel-deployment-drift.mjs` | `--url`, optional expected version/tag/sha | JSON/text summary + exit code | target이 기대 release/sha와 다르면 drift로 exit `2` |
| `should-deploy-ai-engine.sh` | Git refs/env | stdout decision + exit `0` | Git diff 계산 실패 시 보수적으로 deploy |

### 테스트 시나리오 (구현 전 확정)

- [ ] `/api/version`은 `APP_COMMIT_SHA` 또는 `CI_COMMIT_SHA`를 `commitSha`로 노출하고 `shortCommitSha`를 10자로 노출한다.
- [ ] `/api/version`은 `APP_RELEASE_TAG` 또는 `CI_COMMIT_TAG`를 `releaseTag`로 노출한다.
- [ ] post-deploy smoke는 `/api/version.commitSha`가 `--expected-commit-sha`와 다르면 실패한다.
- [ ] deployment drift checker는 버전은 같아도 commit SHA가 다르면 drift를 감지한다.
- [ ] AI Engine deploy guard는 frontend/docs-only diff에서는 skip을 출력하고, `cloud-run/ai-engine/**` 변경에서는 deploy를 출력한다.

## Task 목록

- [ ] Task 0 — failing test 커밋: 위 테스트 시나리오를 먼저 추가하고 실패를 확인한다.
- [ ] Task 1 — `/api/version` 배포 메타데이터와 smoke/drift checker 구현.
- [ ] Task 2 — GitLab CI에 Vercel metadata 주입 및 AI Engine deploy skip guard 적용.
- [ ] Task 3 — targeted validation, 코드리뷰, push 후 GitLab pipeline 확인.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1~2 | `feat(ci):` | 예 | semver tag에서 AI Engine 변경 시만 | semver tag에서 frontend deploy |
| Task 3 | `docs:` 또는 없음 | 예 | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 배포 드리프트/skip 계약을 정확히 표현하는지 |
| Task 1~2 완료 후 | API shape, CI env 주입, free-tier 비용 영향 |
| 전체 완료 후 | 테스트 결과, pipeline status, 잔여 배포 판단 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| GitLab API 확인 실패 | 로컬 테스트와 `not_verified` 상태를 분리 보고 |
| Vercel CLI env 전달 제약 발견 | build-time env 우선, runtime smoke는 release tag 검증으로 축소 |
| AI Engine diff 계산 실패 | free-tier 안전보다 배포 정확성을 우선해 deploy 유지 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `npm run test:contract` 통과
- [ ] targeted QA/CI unit tests 통과
- [ ] `git push gitlab main` 후 pipeline 결과 보고
