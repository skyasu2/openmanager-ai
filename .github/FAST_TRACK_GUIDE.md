# Fast Track CI Guide

## 개요

빠른 배포보다 중요한 것은 **불필요한 GitHub Actions 사용량을 늘리지 않는 것**입니다.

- 표준 경로: 로컬 hook + scope-based GitHub Actions + Vercel 자동 배포
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
git push origin <branch>
```

- `ci-optimized.yml`가 scope 기반으로 필요한 job만 실행
- 프런트엔드 변경이 있을 때만 `E2E Critical` 실행
- AI Engine 변경이 있을 때만 Cloud Run unit/smoke 경로 실행

### 2. 수동 고비용 검증

다음은 필요할 때만 `workflow_dispatch`로 실행합니다.

- `quality-gates.yml`
- `prompt-eval.yml`
- `release-manual.yml`
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
- `release-manual.yml` freshness check
- `artifact-cleanup.yml`

### 중복 실행 방지

- `ci-optimized.yml`는 `concurrency.cancel-in-progress: true`
- 같은 ref에서 새 푸시가 오면 이전 실행을 취소

## 운영 메모

- Vercel이 프런트엔드 배포의 권위 있는 빌드 경로입니다.
- GitHub Actions는 배포와 별개로 품질/보안 게이트를 담당합니다.
- larger runner, 상시 스케줄, 무차별 E2E 상시 실행은 추가하지 않습니다.
