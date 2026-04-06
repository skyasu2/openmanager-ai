# Fast Track CI Guide

## 개요

빠른 배포보다 중요한 것은 **불필요한 GitHub Actions 사용량을 늘리지 않는 것**입니다.

- 표준 경로: 로컬 hook + GitLab CI validate/deploy + Vercel prebuilt 배포(GitLab CI 경유)
- 비용 민감 작업: 수동 실행 우선
- 비필수 schedule: 기본 off

## 기본 원칙

- GitHub Actions를 "항상 성공하는 참고용 배경 작업"으로 취급하지 않습니다.
- 필요한 게이트는 실제로 실패할 수 있어야 합니다.
- 공개 저장소 무료 조건이 바뀌더라도 과도한 자동 실행량이 쌓이지 않도록 설계합니다.

## 권장 경로

### 1. 일반 개발

```bash
git commit -m "feat: change"
git push gitlab <branch>
```

- canonical 배포 반영은 `git push gitlab main`
- GitHub 공개 snapshot 동기화는 명시적으로 `npm run sync:github` 실행
- `origin`은 배포 경로가 아니며 기본 push 대상으로 사용하지 않음

### 2. 수동 고비용 검증

다음은 필요할 때만 `workflow_dispatch`로 실행합니다.

- `quality-gates.yml`
- `prompt-eval.yml`
- `keep-alive.yml`
- `artifact-cleanup.yml`

### 3. `[skip ci]` 사용 기준

```bash
git commit -m "docs: wording update [skip ci]"
```

허용 범위:
- 문서/메타데이터만 바뀐 경우
- 이미 로컬/수동 검증이 끝난 긴급 운영성 변경

지양:
- 동작 변경이 포함된 일반 기능/버그 수정
- E2E나 계약 테스트를 봐야 하는 변경

## 비용 가드

### schedule 기본값

비필수 스케줄 워크플로는 기본적으로 자동 실행되지 않습니다.

활성화 조건:
- Repository Variables → `ENABLE_ACTIONS_SCHEDULES=true`

영향 받는 워크플로:
- `codeql-analysis.yml`
- `dependabot-auto-merge.yml`의 backfill job
- `branch-cleanup.yml`
- `keep-alive.yml`
- `artifact-cleanup.yml`

### 중복 실행 방지

- `ci-optimized.yml`는 `concurrency.cancel-in-progress: true`
- 같은 ref에서 새 푸시가 오면 이전 실행을 취소

## 운영 메모

- 프런트엔드 배포 권한은 GitLab CI `deploy` job에 있습니다.
- Vercel Git Integration은 해제되어 있으며 GitLab CI가 `vercel build --prod` + `vercel deploy --prebuilt --prod`를 호출합니다.
- GitHub Actions는 보조 워크플로로 유지되며 canonical 배포 경로가 아닙니다.
- `release-manual.yml`은 실행형 sync/release job이 아니라 GitHub mirror guard 문서 역할만 수행합니다.
- larger runner, 상시 스케줄, 무차별 E2E 상시 실행은 추가하지 않습니다.
