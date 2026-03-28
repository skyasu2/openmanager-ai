# GitLab Canonical Delivery Plan

- 상태: Completed (core delivery topology alignment + GitHub public snapshot sync + public repo cleanup 완료)
- 작성일: 2026-03-27
- 갱신일: 2026-03-28
- 목표: `GitLab canonical + Vercel Git deploy + local Docker CI + separate GitHub public snapshot` 구조를 프로젝트의 실제 운영 기준으로 고정하고, 외부 CI 의존을 최소화한다.

## 배경
- 최근 변경은 기능 확장보다 테스트 안정화와 배포 신뢰성 확보에 집중되어 있다.
- 현재 프로젝트는 `Vercel Frontend + Cloud Run AI Engine` 구조이며, 비용 제약상 GitLab SaaS CI를 기본 실행 경로로 두기 어렵다.
- 공개 GitHub 저장소는 private canonical repo의 정확한 mirror가 아니라, 테스트/문서/운영 자산을 제외한 `code-only snapshot`이다.
- GitHub public repo는 이후 orphan snapshot 기반의 최소 공개 이력, no releases/tags, issues/wiki/projects 비활성 상태로 정리되었다.
- 따라서 `GitHub/GitLab 동시 push`를 기본 습관으로 유지하면 canonical 개발 흐름과 공개용 snapshot 흐름이 섞여 운영 리스크가 커진다.

## 최근 커밋 분석

### 최근 핵심 커밋
- `ff9822827` `docs(ci): align gitlab canonical and local docker workflow`
  - 저장소/배포 토폴로지 문서화
  - local Docker CI 스크립트 추가 및 pull policy 반영
- `1d586d24e` `fix(test): stabilize validate-all suites`
  - `validate:all` 안정화
  - root test를 node/dom 스위트로 분리
- `c4771e828` `chore: verify GitLab→Vercel deployment pipeline`
  - GitLab push가 Vercel Git Integration으로 이어지는지 검증
- `40c52ee8f` `test(hooks): add unit tests for useSystemStatus and useTimeSeriesMetrics`
  - 핵심 훅 회귀 테스트 보강

### 해석
- 최근 흐름은 “외부 CI 확대”보다 “배포 권위와 검증 경로를 단순화”하는 방향이 맞다.
- 이 맥락에서 새로운 GitLab SaaS pipeline 도입보다, GitLab canonical 정렬과 local Docker CI 표준화가 우선이다.

## 외부 베스트 프랙티스 비교

### 1. Vercel
- 공식 문서는 Git provider 연결 후 push 기반 배포를 표준 경로로 설명한다.
- GitHub/GitLab/Bitbucket 같은 Git 연동이 primary path이고, CLI/API는 대체 경로다.
- 출처:
  - https://vercel.com/docs
  - https://vercel.com/docs/deployments/deployment-methods

### 2. GitLab CI/CD
- 공식 문서는 GitLab pipeline이 `.gitlab-ci.yml`과 runner를 전제로 동작한다고 설명한다.
- 즉, “GitLab CI를 쓴다”는 것은 결국 YAML + runner 운영 비용/면적을 받아들이는 선택이다.
- 출처:
  - https://docs.gitlab.com/ee/ci/yaml/
  - https://docs.gitlab.com/ee/ci/pipelines/

### 3. GitLab Docker executor
- 공식 문서는 Docker executor에서 image pull policy를 `always`, `if-not-present`, `never`로 조정할 수 있다고 설명한다.
- private/local 성격의 runner에서는 `if-not-present` 또는 `never`가 외부 pull 최소화 측면에서 더 유리하다.
- 출처:
  - https://docs.gitlab.com/runner/executors/docker/

### 4. GitLab push mirroring
- 공식 문서는 push mirror를 upstream의 정확한 downstream mirror 유지 용도로 설명한다.
- downstream에 직접 push하지 않는 전제를 둔다.
- 출처:
  - https://docs.gitlab.com/user/project/repository/mirror/push/

### 비교 결론
- 우리 GitHub는 정확한 mirror가 아니라 공개용 curated snapshot이다.
- 따라서 `GitLab push mirror -> GitHub`보다 `separate public-sync flow`가 더 맞다.
- 현재 프로젝트에는 아래 조합이 최적이다.
  - `GitLab canonical repo`
  - `Vercel Git deploy from GitLab`
  - `local Docker CI as primary full validation`
  - `GitHub public sync as explicit secondary workflow`

## 프로젝트 제약사항 / 기본 규칙
- Free tier 우선: GitLab SaaS CI minutes 소비 최소화
- Frontend 배포 권위: `git push gitlab main` -> Vercel Git Integration
- 공개 GitHub는 deploy source가 아니라 code-only snapshot
- QA final gate는 Vercel 실환경 기준
- broad/deploy-sensitive 변경은 pre-push만으로 끝내지 않고 local Docker CI 추가
- `.gitlab-ci.yml` 부재는 현재 정책상 의도된 상태

## 실행 순서

### Phase 0. 기준선 분석
- [x] 최근 커밋/변경 흐름 분석
- [x] remote topology 확인
- [x] 외부 공식 문서와 현재 구조 비교

### Phase 1. Canonical remote 정렬
- [x] `gitlab`을 canonical push/fetch remote로 고정
- [x] `origin`에서 GitLab push URL 제거
- [x] `remote.pushDefault=gitlab` 설정
- [x] `main` upstream을 `gitlab/main`으로 전환

### Phase 2. 문서/규칙/CI 경로 정렬
- [x] `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `ai-standards.md` 반영
- [x] `docs/development/ci-cd.md` 등 운영 문서 반영
- [x] `npm run ci:local:docker` / `:full` 추가
- [x] `CI_DOCKER_PULL_POLICY` 도입 (`if-not-present` 기본)

### Phase 3. Canonical deploy 검증
- [x] `git push gitlab main`
- [x] Vercel deployment `READY` 확인
- [x] GitLab metadata 기준 배포 소스 확인

### Phase 4. Public snapshot 분리 강화
- [x] GitHub 공개 sync를 canonical push 루프와 분리된 절차로 고정
- [x] public-sync 스크립트/제외 규칙 반영
- [x] 공개 repo 반영은 명시적 요청이 있을 때만 수행

### Phase 5. Public GitHub cleanup
- [x] GitHub public repo 이력을 최소 공개 snapshot 중심으로 재정렬
- [x] GitHub releases/tags 제거
- [x] GitHub issues/wiki/projects 비활성
- [x] GitHub를 deploy/release authority가 아닌 public code surface로 고정

## 완료 기준
- [x] local git remote topology가 문서와 일치
- [x] local Docker CI가 실제로 통과
- [x] canonical push가 `gitlab`만 대상으로 수행
- [x] GitLab push 기반 Vercel production deployment가 `READY`
- [x] GitHub 공개 sync가 canonical push 루프에서 분리

## 현재 실행 결과 (2026-03-27)
- `git remote -v` 정리 완료:
  - `gitlab`: fetch/push
  - `origin`: GitHub fetch/push only
- `main` upstream: `gitlab/main`
- local Docker CI 통과:
  - root node `158 passed / 3 skipped`
  - root dom `82 passed`
  - ai-engine `61 passed`
- canonical 반영:
  - commit `ff9822827`
  - `git push gitlab main` 완료
- Vercel production 배포 확인:
  - deployment `dpl_HaXUuu6ewS38hYCVoFuwx5oKL6Ru`
  - commit `ff98228271837388466a6000e7860a1dc7d9353f`
  - status `READY`
  - `gitSource.type=gitlab`
  - `gitlabProjectPath=skyasu2/openmanager-ai`
- public GitHub snapshot sync 자동화 확인:
  - script `scripts/sync/github-sync.sh`
  - exclude list `.github-export-ignore`
  - scripts `npm run sync:github`, `npm run sync:github:dry-run`
  - `npm run sync:github` 실행 완료
- public GitHub cleanup 확인:
  - orphan snapshot 기반 최소 공개 이력 유지
  - releases/tags 없음
  - issues/wiki/projects 비활성
  - description: `public code snapshot; full repo on GitLab`

## 표준 워크플로우

```bash
git push gitlab main       # canonical push / Vercel 배포
npm run sync:github        # GitHub 코드 스냅샷 동기화 (선택)
```

release/tag가 필요한 경우는 아래 canonical 경로를 사용합니다.

```bash
npm run release:patch
git push gitlab --follow-tags
```

## 후속 과제 (Optional)
- historical GitHub Actions 문서를 더 줄일지 여부 결정

## 후속 의사결정 기준 (2026-03-27 추가)

### 최근 추가 분석
- 최근 커밋 흐름은 계속해서 테스트 안정화, 배포 토폴로지 단순화, 공개/비공개 저장소 분리에 집중되어 있다.
- 현재 canonical push와 Vercel 자동 배포는 안정화되었고, 남은 선택지는 `GitLab native CI를 언제 도입할 것인가`에 가깝다.

### 비교 평가

| 선택지 | 비용/쿼터 | 장점 | 단점 | 현재 판단 |
|---|---|---|---|---|
| GitLab.com shared runner | Free quota 소모 | GitLab 상태 체크 즉시 사용 | 월 compute quota 소모, 외부 실행 면적 증가 | 보류 |
| self-hosted runner + Docker executor | GitLab quota 0 | GitLab status check + 재현성 강화 | host 보안/운영 부담 | 조건부 후보 |
| 현재 local Docker CI | GitLab quota 0 | 가장 단순, 외부 의존 최소화 | GitLab native status 없음 | 유지 |

### 실행 순서

1. 현행 유지: `pre-push hook` + `npm run ci:local:docker`
2. broad/deploy-sensitive 변경 또는 release 전에는 `CI_DOCKER_INSTALL_MODE=npm-ci npm run ci:local:docker` 1회 추가
3. 보안/네트워크 면적을 더 줄여야 할 때만 `CI_DOCKER_PULL_POLICY=never`
4. GitLab MR required status check가 필요해질 때만 self-hosted runner 검토
5. runner 도입 시 `.gitlab-ci.yml`은 최소 job만 유지하고 shared runner는 기본 비활성 유지

### self-hosted runner 도입 트리거

아래 항목이 2개 이상 겹치면 self-hosted runner 검토를 시작한다.

- GitLab Merge Request에서 required status check가 필요하다
- 여러 개발자가 동일한 검증 기준을 공유해야 한다
- 로컬 수동 검증 반복이 release cadence를 방해한다
- 개인 로컬 머신에서만 검증하는 구조가 리스크로 인식된다

### 검토 시 기본 원칙

- `Docker executor`
- `non-privileged`
- single-project / trusted private 전용
- protected branch 중심
- 최소 `.gitlab-ci.yml`
