# CI/CD 파이프라인 & 의존성 관리

> GitLab canonical + GitLab CI validate→deploy + Vercel CLI 배포 운영 가이드
> Owner: platform-devops
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-03-31
> Canonical: docs/development/ci-cd.md
> Tags: ci,cd,gitlab,vercel,github-actions,automation

## 개요

현재 운영 기준은 **GitLab canonical repo + GitLab CI validate→deploy + 로컬 Docker CI 보강 검증** 입니다. 아래 GitHub Actions 내용은 과거/보조 레퍼런스로 유지되며, primary delivery path는 아닙니다.

```
코드 변경 → pre-commit / pre-push / 필요 시 `npm run ci:local:docker`
        → `git push gitlab main`
        → GitLab CI validate (`type-check` + `lint:ci` + `test:quick`)
        → GitLab CI deploy (`vercel build --prod` + `vercel deploy --prebuilt --prod`)
        → Vercel production
        → Cloud Run 수동 배포 (`deploy.sh`, 필요 시)

공개 코드 공유 → GitLab 기준 공개용 snapshot 생성 → GitHub 수동 동기화
```

## 현재 저장소/배포 토폴로지 (2026-03-31)

- **GitLab private (`gitlab`)**: canonical development repo
- **Vercel Frontend**: GitLab CI `deploy` job이 `vercel build` + `vercel deploy --prebuilt --prod`로 production 배포
- **GitLab CI**: 활성 (`validate -> deploy`, 코드 변경 push 시만 실행)
- **`.gitlab-ci.yml`**: 최소 파이프라인으로 유지. docs/reports 전용 push는 `changes` 규칙으로 CI 스킵
- **GitHub public (`origin`)**: code-only snapshot, 수동 동기화 전용
- **GitHub public history**: orphan snapshot 기반의 최소 공개 이력만 유지
- **GitHub releases/tags**: 사용하지 않음
- **GitHub issues/wiki/projects**: 비활성
- **Dependency updates**: GitHub Dependabot 대신 self-hosted Renovate 사용
- **Local CI**: `npm run ci:local:docker` 를 broad/release 전 전체 검증 보강 경로로 사용

## GitLab vs GitHub 현재 역할 비교

| 항목 | GitLab (`gitlab`) | GitHub (`origin`) |
|---|---|---|
| 저장소 성격 | private canonical repo | public code snapshot |
| 이력 범위 | full history | 최소 공개 이력 |
| 테스트/문서/QA 기록 | 유지 | 제외 |
| release/tag 권위 | 있음 | 없음 |
| 배포 권위 | 있음 | 없음 |
| Vercel frontend 배포 권위 | GitLab CI `deploy` job | 사용 안 함 |
| 공개 코드 갱신 | source of truth | `npm run sync:github` 결과물 |
| collaboration surface | private development/MR | 읽기 전용 성격, issues/wiki/projects 비활성 |

## 앞으로의 배포/공개 경로

일상적인 운영 경로는 세 갈래로 고정합니다.

1. Frontend 배포
- `git push gitlab main`
- GitLab CI `validate`
- GitLab CI `deploy` (`vercel build --prod` + `vercel deploy --prebuilt --prod`)

1. Release / tag
- `npm run release:patch|minor|major`
- `git push gitlab --follow-tags`
- canonical release/tag는 GitLab 기준으로만 유지

1. Public GitHub refresh
- `npm run sync:github`
- GitLab canonical 기준 code-only snapshot만 GitHub에 반영
- GitHub는 deploy source가 아니므로 `git push origin`을 배포 절차로 사용하지 않음

1. Cloud Run AI Engine
- `cloud-run/ai-engine/deploy.sh`
- Frontend와 별도 수동 배포 경로

1. Supabase schema / data
- `supabase/migrations/`, `supabase/seeds/` 기준 관리
- Git push만으로 자동 반영되지 않음
- 필요 시 `npx supabase db push` 또는 SQL 수동 실행
- 현재 레포에는 별도 Supabase Edge Function 배포 경로가 없음

## Local Docker CI (Supplemental Full Validation)

현재 로컬 전체 검증 표준 경로는 `scripts/ci/local-docker-ci.sh` 입니다. GitLab CI를 대체하는 경로가 아니라, broad change / release 전 전체 검증을 보강하는 경로로 사용합니다.

```bash
# 기본: host node_modules 재사용 + container network 차단
npm run ci:local:docker

# AI Engine docker preflight까지 포함
npm run ci:local:docker:full

# 깨끗한 설치 기반으로 1회 검증이 필요할 때
CI_DOCKER_INSTALL_MODE=npm-ci npm run ci:local:docker

# 외부 pull까지 완전히 막고 캐시된 이미지로만 실행할 때
CI_DOCKER_PULL_POLICY=never npm run ci:local:docker
```

운영 원칙:
- `.gitlab-ci.yml`은 현재 validate → deploy 최소 파이프라인으로 유지합니다. 더 무거운 검증까지 CI에 모두 넣지 않습니다.
- 기본 모드 `prefer-local`은 host `node_modules`를 재사용하고 container를 `--network none`으로 실행해 외부 접근을 최소화합니다.
- 기본 pull policy는 `if-not-present` 입니다. 최초 base image pull 이후에는 로컬 이미지 캐시를 재사용합니다.
- 외부 pull까지 막아야 할 때는 `CI_DOCKER_PULL_POLICY=never` 를 사용합니다.
- `npm-ci` 모드는 새 의존성 설치가 필요할 때만 사용합니다.
- broad change, release 전, 배포 민감 변경에서는 pre-push hook만으로 끝내지 말고 `npm run ci:local:docker`를 추가로 실행합니다.
- docs/reports 전용 push는 `.gitlab-ci.yml`의 `changes` 규칙으로 CI가 스킵되므로, 별도 코드 검증이 필요 없을 때만 사용합니다.

### 선택지 비교

| 선택지 | GitLab 비용 | 외부 의존 | 상태 체크 | 현재 프로젝트 적합도 |
|---|---:|---|---|---|
| wsl2-docker self-hosted runner | GitLab quota 0 | 중간 | 높음 | 활성 (`validate` job) |
| GitLab.com shared runner | 월 compute quota 소모 | 낮음 | 높음 | 활성 (`deploy` job) |
| 현재 로컬 Docker CI | GitLab quota 0 | 낮음 | GitLab native status 없음 | broad/release 보강 |

판단 기준:
- `validate` job은 `tags: [wsl2-docker]`가 붙은 self-hosted runner에서 실행되어 GitLab compute minutes를 소모하지 않습니다.
- `deploy` job은 태그 없이 GitLab.com shared runner에서 실행되며, 현재 기준 약 4분 내외의 compute quota를 사용합니다.
- 현재 프로젝트는 single canonical repo, 개인 개발 중심 구조이므로 validate는 self-hosted로 비용을 절감하고, deploy는 shared runner + Vercel CLI로 유지하는 split-runner 구성이 가장 단순합니다.

### 권장 실행 순서

1. 기본 경로는 `pre-commit` + `pre-push`
2. broad change, release 전, 배포 민감 변경에는 `npm run ci:local:docker`를 push 전에 추가
3. canonical 반영은 `git push gitlab main`
4. GitLab CI `validate`는 `wsl2-docker` self-hosted runner에서 실행
5. GitLab CI `deploy`는 shared runner에서 `vercel build --prod` + `vercel deploy --prebuilt --prod` 수행
6. 외부 pull까지 차단해야 할 때만 `CI_DOCKER_PULL_POLICY=never` 사용

### 현재 운영 구성

- `validate` runner: `wsl2-docker` self-hosted runner
- 서비스: WSL2 Ubuntu 내 `gitlab-runner` systemd 서비스 자동 시작
- executor: `Docker`
- 기본 이미지: `node:24-bookworm`
- 태그 정책: `tags: [wsl2-docker]`, `run_untagged = false`
- pull policy: `if-not-present`
- `deploy` runner: GitLab.com shared runner (태그 없음)

운영 메모:
- WSL2 runner가 꺼져 있으면 `validate` job은 pending 상태로 남습니다.
- 이 경우 기본 대응은 WSL2 / `gitlab-runner` 서비스를 다시 올리는 것입니다.
- 임시 우회가 정말 필요할 때만 `validate` job의 태그를 제거해 shared runner 경로로 전환합니다.

즉, **현재는 self-hosted validate + shared deploy + local Docker CI 보강 검증** 구성이 기본 운영값입니다.

### 비용 정책

- **GitLab CI**: 활성. 무료 400분/월 예산을 넘기지 않도록 validate→deploy 최소 파이프라인과 docs/reports skip 규칙을 유지
- **Local Docker CI**: broad/release 전 전체 검증을 보강할 때 우선 사용
- **GitHub Actions**: 역사적/보조 워크플로우 레퍼런스이며 primary delivery path가 아님
- **스케줄 워크플로우 기본값**: 비용/정책 변경 리스크를 줄이기 위해 비필수 `schedule` 잡은 기본적으로 꺼져 있습니다. 자동 실행이 꼭 필요할 때만 저장소 변수 `ENABLE_ACTIONS_SCHEDULES=true`로 명시적으로 활성화합니다.
- **Vercel**: 프론트엔드 빌드/배포의 권위 있는 경로입니다. GitHub Actions에서 중복 빌드를 늘리지 않습니다.
- **Cloud Run**: `deploy.sh` + Cloud Build free-tier 가드 기준으로 운영합니다.

### 판단 근거 (Official Docs)

- GitLab instance runner compute quota는 월 단위로 reset되며, quota 초과 시 shared runner job 처리가 중단됩니다.
- project/group runner는 이 compute quota의 직접 대상이 아닙니다.
- GitLab self-managed runner는 원격 코드 실행 서비스이므로 보안 격리와 host hardening이 필수입니다.
- Docker executor는 non-privileged가 기본 권장이고, trusted single-project runner가 아니라면 `if-not-present` pull policy를 신중하게 사용해야 합니다.

---

## Historical Appendix: GitHub Actions 워크플로우 (Legacy)

> 아래 섹션은 현재 운영 경로가 아닙니다.
> 현재 primary delivery path는 `git push gitlab main` → GitLab CI `validate` (`wsl2-docker`) → GitLab CI `deploy` (shared runner) → Vercel production 입니다.
> 이후 내용은 과거 GitHub Actions 구성과 보조 자동화 참고용으로만 유지합니다.

### 워크플로우 전체 맵

| # | 워크플로우 | 파일 | 트리거 | 역할 |
|---|----------|------|--------|------|
| 1 | **CI/CD Core Gates** | `ci-optimized.yml` | Push/PR (main, develop) | 🔒 **핵심 차단형 CI** |
| 2 | **Quality Gates** | `quality-gates.yml` | 수동 전용 | 📊 추가 품질 점검 |
| 3 | **CodeQL Analysis** | `codeql-analysis.yml` | Push/PR + 선택적 주간 스케줄 | 🔐 정적 보안 분석 |
| 4 | **Dependabot Auto-Merge** | `dependabot-auto-merge.yml` | Dependabot PR + 선택적 스케줄 backfill | 🤖 패치 자동 머지 |
| 5 | **Branch & PR Cleanup** | `branch-cleanup.yml` | 선택적 주간 스케줄 / 수동 | 🧹 브랜치/PR 정리 |
| 6 | **Keep Services Alive** | `keep-alive.yml` | 선택적 주 2회 스케줄 / 수동 | 💓 Supabase 비활성화 방지 |
| 7 | **Prompt Evaluation** | `prompt-eval.yml` | 수동 전용 | 🔬 Promptfoo 테스트 |
| 8 | **Docs Quality** | `docs-quality.yml` | docs 변경 / 수동 | 📝 문서 품질 검증 |
| 9 | **Release Manual** | `release-manual.yml` | 수동 릴리즈 + 선택적 freshness check | 🏷️ 버전/태그/CHANGELOG 릴리즈 |
| 10 | **Cleanup CI Artifacts** | `artifact-cleanup.yml` | 선택적 주간 스케줄 / 수동 | 🗑️ Playwright artifact 정리 |

### 스케줄 가드

비필수 스케줄 잡은 기본적으로 자동 실행되지 않습니다.

- 기본값: `ENABLE_ACTIONS_SCHEDULES` 미설정 또는 `false`
- 자동 실행 허용: 저장소 변수 `ENABLE_ACTIONS_SCHEDULES=true`
- 수동 실행: `workflow_dispatch`는 그대로 사용 가능

---

### 1. CI/CD Core Gates (`ci-optimized.yml`) — 핵심 게이트

**가장 중요한 워크플로우.** 모든 PR과 main/develop 푸시 시 자동 실행.

```
Push/PR
  ├── code-quality (차단형)
  │   ├── Biome Check
  │   └── TypeScript Check
  │
  ├── unit-tests (차단형)
  │   ├── npm run test:quick
  │   └── npm run test:contract
  │
  ├── e2e-critical (차단형, 프론트엔드 변경 시만)
  │   └── npm run test:e2e:critical
  │
  ├── security-scan (main/PR 차단형)
  │   └── Hardcoded Secrets Check
  │
  └── deployment-ready (게이트)
      └── 위 차단형 job 통과 시 → ✅ 배포 준비 완료
```

**NPM 429 에러 대응**: CI 환경에서 npm registry 429 (Rate Limit) 에러가 빈번하므로, retry 로직이 내장되어 있습니다:
- 최대 3회 재시도
- 15→25→35초 증분 대기
- 실패 시 npm cache 강제 정리

**스킵 조건**:
- `[skip ci]`가 커밋 메시지에 포함된 push → 완전 스킵
- `docs/**`, `**/*.md` 변경 → paths-ignore로 자동 제외

**비용 제어 포인트**:
- `detect-scope`가 `frontend_changed`를 계산하고, 무거운 `E2E Critical`은 실제 프론트엔드 변경이나 수동 실행에서만 동작
- `ai_engine_changed`가 `false`면 Cloud Run 전용 검증은 생략
- `concurrency.cancel-in-progress: true`로 같은 ref의 중복 실행을 자동 취소

**동시성 제어**:
```yaml
concurrency:
  group: ci-core-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # 같은 브랜치의 이전 실행 자동 취소
```

---

### 2. Quality Gates (`quality-gates.yml`) — 수동 품질 점검

정기 스케줄이 아니라 **수동 실행 전용**입니다.

| Job | 검사 항목 |
|-----|----------|
| TypeScript Zero-Error Gate | `npm run type-check` 에러 0개 강제 |
| Hook Dependencies Check | Biome 정적 분석 |
| Architecture Health | 대형 컴포넌트 탐지 (500줄+), 순환 의존성 검사 |

**아키텍처 건강성** 검사는 코드 복잡도가 점진적으로 증가하는 것을 방지합니다:
- `find src/components -name "*.tsx" | wc -l > 500` → 경고
- `madge --circular` → 순환 참조 검출

---

### 3. CodeQL Analysis (`codeql-analysis.yml`)

- `push`/`pull_request`에는 자동 실행
- 주간 `schedule`은 `ENABLE_ACTIONS_SCHEDULES=true`일 때만 실행
- 공개 저장소라도 CodeQL 주간 스캔을 기본 on으로 두지 않고, 운영자가 명시적으로 활성화할 때만 주기 실행합니다.

---

### 4. Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

→ historical reference only. 현재 canonical 경로는 [Part 2: Renovate 의존성 관리](#part-2-renovate-의존성-관리) 참조

---

### 5. Branch & PR Cleanup (`branch-cleanup.yml`) — 자동 정리

수동 실행은 항상 가능하고, 주간 스케줄은 `ENABLE_ACTIONS_SCHEDULES=true`일 때만 실행됩니다.

| Job | 역할 |
|-----|------|
| 🧹 Stale Branch Cleanup | 30일 이상 미사용 원격 브랜치 탐지 (보호 브랜치 제외) |
| 📦 Dependabot PR Status | 7일 이상 미처리 Dependabot PR 경고 |
| 🗑️ Merged Branch Cleanup | 이미 main에 병합된 브랜치 탐지 |
| 📊 Weekly Summary | GITHUB_STEP_SUMMARY에 종합 리포트 |

> 자동 삭제는 수행하지 않고 **탐지 + 리포트**만 수행합니다. 삭제는 수동으로 진행합니다.

---

### 6. Keep Services Alive (`keep-alive.yml`) — 비활성화 방지

**목적**: Supabase 무료 티어는 **1주일 미사용 시 프로젝트 자동 일시 정지(Pause)**. 이를 방지하기 위해 주 2회 ping을 보냅니다.

- **Supabase Ping**: REST API에 `apikey` 헤더로 요청 → HTTP 200 확인
- **Vercel Health Ping**: `/api/health` 엔드포인트 상태 확인

스케줄: 매주 **수요일 + 일요일** 09:00 KST.

운영 원칙:
- 기본값은 off
- 실제로 keep-alive가 필요한 기간에만 `ENABLE_ACTIONS_SCHEDULES=true`
- 필요 없으면 수동 실행만 사용

---

### 7. Prompt Evaluation (`prompt-eval.yml`) — AI 프롬프트 품질

AI Engine의 프롬프트가 변경될 때 [Promptfoo](https://promptfoo.dev/)로 자동 평가합니다.

```
cloud-run/ai-engine/promptfoo/** 변경 → Promptfoo eval 실행
cloud-run/ai-engine/src/agents/** 변경 → Promptfoo eval 실행
```

- 기본 평가: `promptfooconfig.yaml` 기반
- Red-team 보안 테스트: 수동 실행 시 `run_redteam: true` 옵션으로 활성화
- 결과: GitHub Artifacts에 30일간 보관

---

### 8. Docs Quality (`docs-quality.yml`) — 문서 품질

`docs/` 변경 시 자동 실행되며, 전체 외부 링크 검사는 수동 실행 시에만 동작합니다.

| 검사 | 내용 |
|------|------|
| `docs:check` | Markdown 구조, Diataxis 분류, 메타데이터 검증 |
| `docs:lint:changed` | 변경된 문서만 Markdown lint |
| 버전 정합성 | `CLAUDE.md`, `GEMINI.md`에 `package.json` 버전 반영 확인 |
| 외부 링크 | 수동 실행 시만 전체 외부 링크 유효성 검사 |

---

### 9. Release Manual (`release-manual.yml`) — 수동 릴리즈

릴리즈 자체는 `workflow_dispatch`로만 실행합니다. 주간 freshness check는 `ENABLE_ACTIONS_SCHEDULES=true`일 때만 동작합니다.

- 입력값: `release_type` (`patch|minor|major`), `dry_run` (`true|false`)
- 실행 흐름:
  - `npm ci`
  - `npm run release:<type>` (또는 `release:dry-run`)
  - `npm run release:check` (태그/CHANGELOG/버전 + freshness required)
  - `git push --follow-tags`
- 제약: `main` 브랜치에서만 실행 허용

릴리즈 전 일상 배포는 `git push gitlab main` → GitLab CI `validate` → GitLab CI `deploy`로 처리합니다.

---

### 10. Cleanup CI Artifacts (`artifact-cleanup.yml`)

Playwright 실패 산출물이 Actions storage를 잠식하지 않도록 오래된 artifact를 정리합니다.

- 수동 실행은 항상 가능
- 주간 스케줄은 `ENABLE_ACTIONS_SCHEDULES=true`일 때만 실행
- 삭제 대상: `playwright-report-*`, `playwright-results-*`
- 보존 기준: 7일 초과 artifact

---

## Part 2: Renovate 의존성 관리

### 현재 운영 결론

- GitHub public snapshot에는 `.github/dependabot.yml`과 GitHub Actions가 노출되지 않으므로 Dependabot/auto-merge 워크플로우는 canonical delivery path가 아닙니다.
- Renovate 공식 문서 기준 hosted GitLab.com app은 현재 offline 상태이므로, GitLab canonical repo에는 self-hosted 경로를 사용합니다.
- 현재 프로젝트 제약에서는 **always-on bot server보다 local Docker self-hosted runner**가 더 적합합니다.

### 현재 설정 파일

- repo config: `renovate.json`
- self-hosted compose: `config/renovate/docker-compose.yml`
- env example: `config/renovate/renovate.env.example`
- run script: `scripts/renovate/run-self-hosted.sh`

### 실행 방법

```bash
cp config/renovate/renovate.env.example config/renovate/.env
# config/renovate/.env 에 RENOVATE_TOKEN 입력

npm run renovate:config:check
npm run renovate:dry-run
npm run renovate:run
```

운영 원칙:
- 실행 주기는 Renovate config 내부가 아니라 **호스트 스케줄러**에서 관리합니다.
- 권장 주기: 매일 00:30 KST 1회
- Windows 기준 Task Scheduler, Linux/WSL 기준 cron/systemd timer 사용
- 현재 GitLab CI gate가 생겼더라도 **automerge는 기본 비활성** 상태를 유지합니다.

### 현재 Renovate 정책

| 항목 | 현재값 |
|------|--------|
| 그룹화 | TypeScript / types / testing / linting / react / react-types / ai-sdk |
| PR 제한 | 동시 5개, 시간당 5개 |
| 리뷰 기본값 | `skyasu2` assignee/reviewer |
| patch 업데이트 | `patch-update` 라벨 부여 |
| minor/major 업데이트 | `needs-review` 라벨 부여 |
| automerge | 비활성 |

### 왜 automerge를 지금 바로 켜지 않는가

- 이전 Dependabot patch automerge는 GitHub Actions CI 보호막 위에서 동작했습니다.
- 현재 GitLab canonical 경로에는 validate→deploy gate가 있지만, dependency update까지 자동 병합하면 운영자 승인 없이 production 반영까지 이어질 수 있습니다.
- 따라서 patch라도 자동 병합까지 열지 않고, validate 통과 여부와 별개로 수동 승인 단계를 유지합니다.
- 지금 단계에서는 **MR 자동 생성 + 그룹화 + 수동 승인**이 맞습니다.

### historical GitHub reference

아래 내용은 과거 GitHub-only 운영 참고용으로만 유지합니다.

### 설정 파일: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'daily'           # 유지보수 모드: patch 부채 방지
    open-pull-requests-limit: 5   # PR 폭탄 방지
    assignees: ['skyasu2']
    reviewers: ['skyasu2']
```

### 의존성 그룹화

관련 패키지를 묶어서 PR 수를 줄입니다:

| 그룹명 | 패턴 | 예시 |
|--------|------|------|
| `typescript-core` | `typescript` | TypeScript 코어 |
| `types` | `@types/*` | 일반 타입 정의 |
| `testing` | `vitest`, `@vitest/*`, `playwright`, `@playwright/*` | 테스트 도구 |
| `linting` | `@biomejs/*` | 린팅/포매팅 |
| `react` | `react`, `react-dom` | React 런타임 |
| `react-types` | `@types/react*` | React 타입 정의 |
| `ai-sdk` | `ai`, `@ai-sdk/*` | Vercel AI SDK |

### Auto-Merge 워크플로우

`.github/workflows/dependabot-auto-merge.yml`의 자동 머지 정책:

```
Dependabot PR 생성
  │
  ├── Patch (x.x.1 → x.x.2)
  │   └── CI 통과 → ✅ 자동 squash merge (gh pr merge --auto --squash)
  │
  └── Minor/Major (x.1.0 → x.2.0 or 1.x → 2.x)
      ├── "needs-review" 라벨 추가
      └── 코멘트: "⚠️ 수동 리뷰가 필요합니다"
```

### 결정 근거

| 정책 | 이유 |
|------|------|
| Patch 자동 머지 | 유지보수 모드에서 patch를 매일 흡수해 기술 부채 누적을 막음 |
| Minor/Major 수동 리뷰 | Breaking change, API 변경 가능성 → 수동 검증 필요 |
| 매일 실행 | patch는 빨리 흡수하고, 큰 변경은 review label로 자동 분리 |
| 최대 5 PR | Dependabot PR이 쌓여 리뷰 부담이 되는 것 방지 |

현재 canonical GitLab 운영에서는 위 정책을 **그룹화/라벨링까지만 유지**하고, 자동 머지는 보류합니다.

---

## Part 3: 배포 전략

### Vercel (Frontend) — GitLab CI 경유 배포

```
`git push gitlab main`
        → GitLab CI validate
        → GitLab CI deploy (`vercel build --prod` + `vercel deploy --prebuilt --prod`)
        → Vercel Production
```

- GitLab CI validate→deploy가 품질 게이트와 배포 경로 역할을 함께 담당합니다.
- Vercel Git Integration은 해제되어 있어 Git push만으로 Vercel이 별도 자동 빌드를 시작하지 않습니다.
- `SKIP_ENV_VALIDATION=true`로 환경변수 없이도 빌드 성공 보장
- 기본 Git push 대상은 canonical remote인 `gitlab` 입니다.

배포 트리거 전 인증 체크(혼입 방지):
```bash
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh auth status -h github.com
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh api user -q .login
git remote -v | head -n 2
```

### Cloud Run (AI Engine) — 수동 배포

```bash
cd cloud-run/ai-engine
bash deploy.sh
```

배포 파이프라인:
```
Free Tier 가드레일 검증 → 로컬 Docker 프리플라이트 → SSOT 데이터 동기화
  → Cloud Build (이미지 빌드) → Cloud Run 배포 → 헬스체크
  → 이전 이미지/리비전 자동 정리 (백그라운드)
```

---

## 관련 문서

- [프로젝트 셋업](./project-setup.md) - 로컬 개발 환경 설정
- [Docker 가이드](./docker.md) - Cloud Run 컨테이너 배포 상세
- [Git Hooks 워크플로우](./git-hooks-workflow.md) - 로컬 Git hooks
- [Free Tier 최적화](../reference/architecture/infrastructure/free-tier-optimization.md)

_Last Updated: 2026-03-31_
