# Work History - 2026-03-28

- 날짜: 2026-03-28
- 성격: 작업 이력(참조용)
- 목적: 최근 delivery/tooling 정리 결과와 현재 시점의 운영 결론을 기록

## 완료 작업

1. pre-push hook 경량화 및 회귀 테스트 보강
- `pre-push.js`를 역할별 모듈로 분리하고, no-op push에서 과검증이 돌지 않도록 fallback/base-ref 로직을 정리했다.
- `pre-push-base-ref`, `pre-push-changed-files`, `typecheck-changed` 경로에 회귀 테스트를 추가해 GitLab canonical topology 기준 동작을 고정했다.
- 관련 커밋/파일:
  - `3fe2aa69e` `refactor(hooks): split pre-push.js (1137→595 lines) into 3 focused modules`
  - `a5510c80f` `fix(hooks): skip no-op push fallback overvalidation`
  - `c01e0c152` `fix(hooks): skip no-op pre-push validation`
  - `6b80187a4` `test(ci): cover pre-push base ref and renovate validation`
  - `scripts/hooks/pre-push.js`
  - `scripts/hooks/pre-push-base-ref.js`
  - `scripts/hooks/pre-push-changed-files.js`
  - `tests/unit/dev/pre-push-base-ref.test.ts`

2. GitHub public snapshot sync 가드레일 강화
- 공개 스냅샷 생성 시 하드코딩된 `package.json` 스크립트 정리를 allowlist 기반 필터로 바꾸고, sync 스크립트를 보조 모듈로 분리했다.
- dirty worktree 가이드와 sync guard 테스트를 추가해 public snapshot 흐름을 canonical 개발 흐름과 더 분리했다.
- 관련 커밋/파일:
  - `2b539d0da` `refactor(sync): replace hardcoded package.json scripts with allowlist filter`
  - `acf0c85ce` `refactor(sync): extract filter-public-scripts.js + add dirty-check stash guide`
  - `dd9acdcc8` `test(sync): cover github snapshot guards`
  - `scripts/sync/github-sync.sh`
  - `scripts/sync/filter-public-scripts.js`
  - `tests/unit/dev/github-sync.test.ts`

3. v8.10.3 release 및 TODO 기록 정리
- `pre-push` 모듈화 작업을 `v8.10.3`로 릴리즈했고, 연계된 completed 항목을 `TODO.md`에 반영했다.
- 관련 커밋/파일:
  - `c7d8426ac` `chore(release): 8.10.3`
  - `ce2a0bec5` `docs(todo): record pre-push refactoring and v8.10.3 release`
  - `reports/planning/TODO.md`

4. Knip dead-code 정리와 severity 기준 세분화
- dead export/function을 제거하고, `knip` severity를 `error` / `warn`으로 구분해 운영 신호를 정리했다.
- 릴리즈 노이즈를 줄이기 위해 changelog 타입 필터도 보강했다.
- 관련 커밋/파일:
  - `1c2991113` `chore(tooling): knip severity rules + changelog type filter`
  - `a0a3fb23a` `refactor: remove unused cache helper fns and RATE_LIMIT_CONFIGS`
  - `26af21e22` `docs(todo): record knip dead-code cleanup and sync completions`
  - `knip.json`
  - `.versionrc.json`
  - `reports/planning/TODO.md`

## 외부 베스트 프랙티스 재확인

- Vercel은 Git provider 연결 배포를 표준 경로로 두고, GitLab push마다 배포를 생성하는 모델을 공식적으로 지원한다.
  - https://vercel.com/docs/git
  - https://vercel.com/docs/deployments/deployment-methods
  - https://vercel.com/docs/deployments/git/vercel-for-gitlab
- GitLab push mirror는 downstream이 upstream의 정확한 사본일 때 적합하다. 현재 GitHub는 code-only snapshot이므로 별도 `sync:github` 흐름 유지가 맞다.
  - https://docs.gitlab.com/user/project/repository/mirror/push/
- GitLab Free의 400 compute minutes는 shared/instance runner 기준이며, 현재처럼 local Docker CI를 primary로 두는 판단은 비용 통제 측면에서 일관된다.
  - https://about.gitlab.com/pricing/
  - https://docs.gitlab.com/ee/ci/pipelines/compute_minutes.html
- Renovate는 GitLab.com hosted app을 쓸 수 없으므로, GitLab canonical 기준에서는 self-hosted 운영이 공식 문서와 맞는다.
  - https://docs.renovatebot.com/getting-started/installing-onboarding/
  - https://docs.renovatebot.com/getting-started/running/

## 결정/보류

- 결정: 현재 프로젝트의 표준 운영 경로는 그대로 유지한다.
  - `git push gitlab main`
  - 필요 시 `npm run ci:local:docker`
  - 필요 시 `npm run sync:github`
- 결정: GitHub는 계속 public code snapshot surface로만 유지한다. push mirror나 GitHub-origin 배포로 되돌리지 않는다.
- 결정: Dependabot 대체는 self-hosted Renovate 기준으로 유지한다. GitLab.com hosted app 가정은 사용하지 않는다.
- 보류: `P3: VibeHistorySection stage4 추가`
- 보류: `P3: Knip unused export types 정리`

## 다음 작업 방향

1. 새 기능/버그/배포 요구가 생기기 전까지 현재 topology와 운영 기준을 유지한다.
2. release 또는 broad change 때만 `npm run ci:local:docker`를 추가 실행한다.
3. 공개 코드 갱신이 필요할 때만 `npm run sync:github`를 실행한다.
