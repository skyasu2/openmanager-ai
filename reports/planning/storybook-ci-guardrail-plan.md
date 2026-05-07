# Storybook CI Guardrail 계획

> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-05-07
> Canonical: reports/planning/storybook-ci-guardrail-plan.md
> Tags: storybook,ci,ui,testing

## 배경

Storybook은 현재 `@storybook/nextjs-vite`, addon-vitest, addon-mcp, 전역 mock, smoke/build 스크립트를 갖추고 있다. 최근 재점검에서 아래 drift를 확인했다.

- `@storybook/addon-mcp@0.4.2`가 npm registry에서 조회되지 않아 fresh install 실패 위험이 있었다.
- dead-code cleanup으로 삭제된 `src/components/ui/*.stories.tsx`를 Storybook cache가 계속 참조해 `storybook:smoke`가 1회 실패했다.
- 공개 소개 데이터의 Storybook story 수가 실제 파일 수와 달랐다.
- GitLab validate job에는 Storybook 전용 guard가 없다.

## 공식 문서 기준

| 기준 | 공식 문서 근거 | 적용 판단 |
|------|----------------|-----------|
| Next.js 프로젝트 Storybook framework | Storybook은 Next.js 앱에서 `@storybook/nextjs-vite`를 권장하며 Vite 기반이라 build/test support가 좋다고 설명한다. <https://storybook.js.org/docs/get-started/frameworks/nextjs-vite> | 현재 설정 유지 |
| 빠른 기동 검증 | Storybook CLI `dev --smoke-test`는 successful start 후 종료한다. `--force-build-preview`는 preview iframe을 강제 빌드하고, `--disable-telemetry`, `--no-version-updates`도 공식 옵션이다. <https://storybook.js.org/docs/api/cli-options> | CI 기본 guard는 `storybook:smoke` |
| Full build | `storybook build`는 static Storybook을 컴파일하고 `--test`로 test용 build 최적화를 할 수 있다. <https://storybook.js.org/docs/api/cli-options> | 기본 branch validate에는 과함. 수동/스케줄/릴리즈 전 검증으로 제한 |
| Storybook Vitest addon | Storybook 공식 CI 문서는 `vitest --project=storybook`을 CI에서 실행하는 예시를 제공하고 Playwright image 또는 브라우저 준비가 필요하다고 안내한다. <https://storybook.js.org/docs/writing-tests/in-ci> | 현재 `test:storybook:experimental`은 기본 CI 제외. 별도 안정화 후 opt-in |
| GitLab job 조건 | GitLab `rules:changes`는 변경 파일이 있을 때만 job을 실행해 CI resource를 줄일 수 있고, `rules`는 pipeline source별 제어에 사용된다. <https://docs.gitlab.com/ci/jobs/job_rules/> | Storybook 관련 변경 경로에만 smoke job 실행 |

## 적용 원칙

1. **기본 CI에는 빠른 smoke만 추가한다.**
   - 목적: story index/import/config/package drift를 빠르게 차단.
   - 실행: `npm run storybook:smoke`.
   - 실패 시: required failure로 취급한다.

2. **Full Storybook build는 기본 validate에 넣지 않는다.**
   - 이유: 기존 기록상 수분 단위이며, root validate 15분 budget을 압박한다.
   - 실행 조건: manual web pipeline, scheduled pipeline, release 전 점검, Storybook 설정/대규모 UI 변경.

3. **Storybook Vitest browser tests는 아직 기본 CI에 넣지 않는다.**
   - 이유: Playwright browser mode 의존과 실행 시간이 커질 수 있다.
   - 조건: 핵심 interaction story를 선별하고 false-pass/flake 기준을 정리한 뒤 별도 plan으로 승격.

4. **변경 경로 기반으로만 실행한다.**
   - `.storybook/**/*`
   - `scripts/storybook/**/*`
   - `config/testing/vitest.config.storybook.ts`
   - `src/**/*.stories.@(ts|tsx)`
   - `src/components/**/*`
   - `src/app/**/*`
   - `package.json`, `package-lock.json`
   - `.gitlab-ci.yml`

## 작업 범위

### Task 1: GitLab CI 경로 앵커 추가

- [ ] `.gitlab-ci.yml`에 `.storybook_validate_paths` anchor 추가
- [ ] `.storybook_validate_changes` rules 추가
- [ ] docs-only / QA 기록 커밋은 기존 validate skip 정책과 충돌하지 않게 유지

### Task 2: `validate_storybook_smoke` job 추가

- [ ] stage: `validate`
- [ ] runner tag: `wsl2-docker`
- [ ] cache: root npm cache 재사용
- [ ] before_script: `npm ci --prefer-offline --cache .npm --no-audit`
- [ ] script: `npm run storybook:smoke`
- [ ] timeout: 8 minutes
- [ ] interruptible: true
- [ ] `rules:changes`로 Storybook/UI 관련 변경에서만 실행

### Task 3: Full build 운영 경로 정리

- [ ] `validate_storybook_build` job을 추가할지 결정
  - 옵션 A: CI job은 추가하지 않고 문서만 유지
  - 옵션 B: `web`/`schedule` source에서만 manual/full build job 추가
- [ ] 적용 시 `npm run storybook:build:ci` 사용
- [ ] 기본 branch/MR validate에는 포함하지 않음

### Task 4: 문서 및 스킬 반영

- [ ] `docs/development/dev-tools.md`에 CI 적용 정책 추가
- [ ] `docs/development/ci-cd.md`에 Storybook smoke job 조건 추가
- [ ] 필요 시 `.agents/skills/lint-smoke/SKILL.md`에 Storybook 관련 변경 시 smoke 실행 기준 추가
- [ ] 신규 story 수치는 컴포넌트 삭제/Chart migration 완료 후 재계산해 `src/data/tech-stacks/vibe-coding.ts`와 맞춤

### Task 5: 검증

- [ ] `npm run storybook:smoke`
- [ ] `bash -n scripts/storybook/smoke.sh`
- [ ] `npm run docs:budget`
- [ ] `npm run docs:ai-consistency`
- [ ] `git diff --check`
- [ ] `.gitlab-ci.yml` syntax 검증 가능 시 GitLab lint 또는 local parser 사용

## 제외 범위

- Chromatic/외부 SaaS visual regression 도입
- 기본 CI에 `storybook:build:ci` 상시 추가
- 기본 CI에 `test:storybook:experimental` 상시 추가
- 삭제된 dead-code story 복원
- Chart migration의 `MiniLineChart` → `SvgSparkline` story 교체 구현

## 리스크와 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| UI 변경마다 CI 시간이 증가 | validate latency 증가 | `rules:changes`로 UI/Storybook 변경에만 실행 |
| Storybook cache가 stale story를 참조 | false failure | `storybook:smoke`에 `--force-build-preview` 유지. 필요 시 CI job에서 `node_modules/.cache/storybook`만 제거하는지 후속 판단 |
| Chart migration 중 story 수 변동 | 공개 소개 문구 drift | Chart migration 완료 후 story count 재계산 |
| shell runner의 browser dependency 부족 | Storybook Vitest flake | browser-mode test는 기본 CI 제외 |

## 완료 기준

- [ ] Storybook/UI/package 변경 MR/branch에서 `validate_storybook_smoke`가 자동 실행된다.
- [ ] docs-only/QA 기록/AI Engine only 변경에서는 Storybook job이 실행되지 않는다.
- [ ] `storybook:smoke` 실패가 Storybook config/import/index drift를 차단한다.
- [ ] full build와 browser-mode tests는 수동/스케줄 또는 별도 계획으로 분리되어 있다.
- [ ] 관련 문서와 TODO가 같은 정책을 가리킨다.
