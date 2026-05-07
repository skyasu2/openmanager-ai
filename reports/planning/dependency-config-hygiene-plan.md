# Dependency & Config Hygiene 계획

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-07
> Canonical: reports/planning/dependency-config-hygiene-plan.md
> Tags: dependencies,config,security,ci,renovate

## 배경

현재 저장소는 root Next.js 앱과 `cloud-run/ai-engine`을 별도 npm 프로젝트로 관리한다. 두 프로젝트 모두 `packageManager: npm@11.10.0`, Node 24 range, `package-lock.json`을 가지고 있고 GitLab CI는 `npm ci`를 사용한다. 이 구조 자체는 맞다.

다만 2026-05-07 registry 기준 점검에서 아래 관리 공백을 확인했다.

- root 패키지는 대부분 최신권이지만 `node_modules`에 삭제된 UI 패키지 잔재가 `extraneous`로 남아 있다.
- AI Engine은 직접 의존성 patch/minor drift가 root보다 크고, runtime audit 이슈가 있다.
- Renovate 설정은 존재하지만 self-hosted 수동 실행 중심이라 정기 lockfile maintenance와 보안 업데이트 추적 신호가 약하다.
- GitHub Actions/Dependabot 파일은 canonical이 아니며 public snapshot에서 제외된다. 실행 경로는 아니지만 로컬 repo 안에서는 historical reference로 남아 있어 혼동 가능성이 있다.

## 공식 기준

| 기준 | 공식 문서 근거 | 적용 판단 |
|------|----------------|-----------|
| 최신성 판단 | `npm outdated`는 registry를 조회하고 `wanted`는 package.json range 내 최대 버전, `latest`는 registry latest dist-tag를 의미한다. <https://docs.npmjs.com/cli/v11/commands/npm-outdated/> | `wanted`까지는 patch/minor 정리 후보, `latest` major는 별도 검토 |
| CI 설치 방식 | `npm ci`는 CI/배포용 clean install이며 lock과 package.json이 불일치하면 실패하고 lockfile을 쓰지 않는다. <https://docs.npmjs.com/cli/v11/commands/npm-ci/> | GitLab CI의 `npm ci` 유지 |
| Renovate npm 탐색 | Renovate npm manager는 기본적으로 모든 `package.json`을 탐지하고 npm datasource, engines, packageManager, overrides를 읽는다. <https://docs.renovatebot.com/modules/manager/npm/> | root와 AI Engine 모두 Renovate 대상이어야 함 |
| Lockfile maintenance | Renovate npm manager는 `package-lock.json` lock file maintenance를 지원한다. <https://docs.renovatebot.com/modules/manager/npm/#lock-file-maintenance> | 정기 lockfile maintenance 추가 후보 |
| PR 과다 방지 | Renovate `prHourlyLimit`/`prConcurrentLimit`는 업데이트 PR 폭증과 CI 과부하를 줄이기 위한 옵션이다. <https://docs.renovatebot.com/configuration-options/#prhourlylimit> | 기존 limit 유지, schedule/approval 보강 |

## 현재 판정

### 정상 관리

- root와 AI Engine이 각각 `package-lock.json`을 가진 별도 npm 프로젝트로 분리되어 있다.
- `.nvmrc`, root/AI Engine `engines`, `devEngines`, `packageManager`가 Node 24 / npm 11로 정렬되어 있다.
- `.npmrc`는 registry, retry, timeout, audit level, progress/fund suppression을 명시한다.
- GitLab CI는 root와 AI Engine 모두 `npm ci --prefer-offline --cache .npm --no-audit`로 clean install을 수행한다.
- GitHub public snapshot은 `.github/`, `docs/`, `tests/`, `scripts/`, `reports/`, `cloud-run/`을 제외하므로 GitHub Actions/Dependabot은 현재 delivery path가 아니다.

### 관리가 덜 되는 부분

| 항목 | 근거 | 영향 | 우선순위 |
|------|------|------|----------|
| root `node_modules` 잔재 | `npm ls --depth=0`에서 삭제된 Radix 계열과 `@emnapi/*`가 `extraneous`로 표시됨 | 로컬 audit/재현 결과가 CI clean install과 달라질 수 있음 | High |
| AI Engine dependency drift | `npm outdated --long`에서 `@ai-sdk/*`, `ai`, `hono`, `@hono/node-server`, `langfuse`, `pg`, `vitest` 등이 `wanted` 뒤처짐 | Cloud Run runtime 보안/호환성 부채 | High |
| AI Engine runtime audit | `npm audit --omit=dev` 결과 Hono/node-server, axios/google logging chain, protobufjs 등 13건 | Cloud Run runtime risk. patch/minor 업데이트 우선 | High |
| root runtime audit | `next@16.1.6`은 `npm outdated`상 최신이지만 `npm audit --omit=dev`는 Next/PostCSS advisory를 보고함 | 강제 fix가 `next@15.5.12` downgrade를 제안하므로 자동 적용 금지. Next 16 보안 릴리즈 대기/추적 필요 | Medium |
| `shadcn` CLI devDependency | 코드 검색상 runtime import는 없고 `components.json`/문서 흔적 중심. audit chain에는 `@modelcontextprotocol/sdk`, `postcss`, `ip-address` 등이 포함됨 | dev-only audit noise와 공급망 표면 증가 | Medium |
| Renovate 운영 신호 부족 | `renovate.json`과 self-hosted compose/script는 있으나 GitLab schedule job 또는 최근 실행 결과 추적이 없음 | patch drift가 누적되기 쉬움 | Medium |
| `clean:all` script | `package-lock.json` 삭제 후 `npm install`을 수행 | deterministic lockfile 운영 원칙과 충돌 가능 | Medium |
| GitHub historical workflow | `.github/`가 로컬 repo에는 남아 있으나 public snapshot에서는 제외 | 실행 위험은 낮지만 신규 세션이 GitHub Actions를 canonical로 오해할 수 있음 | Low |

## 버전 최적성 요약

### root 앱

현재 root는 전반적으로 최신권이다.

- `next@16.1.6`, `react@19.2.4`, `react-dom@19.2.4`, `storybook@10.2.10`, `vitest@4.1.2`, `typescript@6.0.2`, Node `v24.13.1`, npm `11.10.0`.
- `npm outdated --long` 기준 직접 업데이트 후보는 작다.
  - `@storybook/addon-vitest`: `10.2.10` -> `10.2.13`
  - `@types/node`: `25.5.2` -> `25.6.0`
  - `playwright`: `1.58.2` -> `1.59.1`
  - `typescript`: `6.0.2` -> `6.0.3`
  - `jsdom`: `28.1.0` -> `29.0.2`는 major라 별도 검토
- `@upstash/ratelimit`은 현재 표시에 `v2.0.8` prefix 차이가 있으나 wanted/latest는 `2.0.8`로 실질 업데이트 필요성이 낮다.
- Chart migration 완료로 `recharts`는 root dependency에서 제거되었다.

결론: root는 "거의 최적"에 가깝지만, `node_modules` 잔재 정리와 root runtime audit 추적이 선행되어야 한다.

### AI Engine

AI Engine은 "최적 아님"이다. 주요 직접 의존성이 같은 major/minor patch 범위에서 뒤처져 있다.

- AI SDK 계열: `ai 6.0.156 -> 6.0.175`, `@ai-sdk/google 3.0.29 -> 3.0.68`, `@ai-sdk/openai 3.0.29 -> 3.0.62`, `@ai-sdk/groq 3.0.24 -> 3.0.38`, `@ai-sdk/mistral 3.0.20 -> 3.0.35`, `@ai-sdk/cerebras 2.0.33 -> 2.0.50`
- Hono 계열: `hono 4.11.7 -> 4.12.18`, `@hono/node-server 1.19.9 -> 1.19.14`
- Infra/client: `@supabase/supabase-js 2.101.1 -> 2.105.3`, `@upstash/redis 1.36.1 -> 1.38.0`, `pg 8.18.0 -> 8.20.0`, `langfuse 3.38.6 -> 3.38.20`
- Test/tooling: `vitest 4.0.18 -> 4.1.5`, `typescript 6.0.2 -> 6.0.3`, `@types/pg 8.16.0 -> 8.20.0`
- Major 보류 후보: `@hono/node-server 2.x`, `dotenv 17.x`, `pino 10.x`, `zod 4.x`, `@tavily/core 0.7.x`, `promptfoo 0.121.x`

결론: AI Engine은 patch/minor update batch를 우선 적용하고, major는 별도 검증 후 결정한다.

## 적용 원칙

1. **runtime 보안 업데이트를 우선한다.**
   - AI Engine `hono`, `@hono/node-server`, Google logging chain, protobufjs 관련 patch/minor를 먼저 본다.
   - 실 LLM 호출 없이 type-check/test/contract/smoke 중심으로 검증한다.

2. **root는 force downgrade를 금지한다.**
   - `npm audit fix --force`가 `next@15.5.12`를 제안하므로 자동 적용하지 않는다.
   - Next 16 line의 보안 patch가 나오면 별도 patch batch로 처리한다.

3. **dev-only CLI는 상시 dependency인지 재검토한다.**
   - `shadcn` CLI는 runtime import가 없으므로 `npx shadcn@<pinned>` on-demand 전환을 검토한다.
   - `components.json`은 shadcn/ui 컴포넌트 기준 파일로 유지할 수 있다.

4. **자동화는 비용을 만들지 않는 범위에서 보강한다.**
   - default CI에 full audit를 넣지 않는다.
   - Renovate schedule/lockfile maintenance를 보강하되 PR 폭증 방지 limit과 grouping을 유지한다.
   - runtime audit은 수동/스케줄 또는 release preflight 후보로 둔다.

## 작업 범위

### Task 1: 현재 설치 트리 정합성 복구

- [ ] root `node_modules`의 `extraneous` 잔재 정리
- [ ] `npm ci` 후 `npm ls --depth=0` 재확인
- [ ] AI Engine `npm ls --depth=0` 재확인
- [ ] 로컬 audit 결과와 CI clean install 결과가 다를 수 있음을 문서화

### Task 2: AI Engine patch/minor security batch

- [ ] `@ai-sdk/*`, `ai` patch/minor 업데이트
- [ ] `hono`, `@hono/node-server` patch/minor 업데이트
- [ ] `@supabase/supabase-js`, `@upstash/redis`, `pg`, `langfuse`, `@google-cloud/pino-logging-gcp-config` patch/minor 업데이트
- [ ] `vitest`, `typescript`, `@types/node`, `@types/pg` patch 업데이트
- [ ] `cd cloud-run/ai-engine && npm run type-check`
- [ ] `cd cloud-run/ai-engine && npm run test`
- [ ] root 계약 영향이 있으면 `npm run test:contract`
- [ ] `npm audit --omit=dev --audit-level=moderate` 재점검

### Task 3: root low-risk patch batch

- [ ] Storybook patch line: `storybook`, `@storybook/nextjs-vite`, `@storybook/addon-vitest`를 같은 patch line으로 정렬할지 결정
- [ ] `playwright` / `@playwright/test` patch 동시 업데이트
- [ ] `typescript`, `@types/node` patch 업데이트
- [ ] `jsdom 29` major는 test compatibility 확인 전 보류
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run test:quick`
- [ ] `npm run storybook:smoke`는 Storybook patch 변경 시만 실행

### Task 4: `shadcn` CLI dependency 결정

- [ ] 현재 CLI를 npm script에서 쓰는 경로가 있는지 재확인
- [ ] 상시 dependency 유지 vs `npx shadcn@<pinned>` on-demand 전환 결정
- [ ] 제거 시 `components.json`과 기존 shadcn/ui 컴포넌트는 유지
- [ ] 제거 시 root audit noise 감소 확인

### Task 5: Renovate 운영 보강

- [ ] `renovate.json`에 `lockFileMaintenance` 도입 검토
- [ ] AI Engine/Hono/Storybook/Playwright 그룹 명시 보강
- [ ] patch PR 폭증 방지를 위해 `prHourlyLimit`, `prConcurrentLimit` 유지
- [ ] GitLab schedule 또는 수동 `renovate:run` 결과를 TODO/운영 문서에 남기는 절차 추가
- [ ] `npm run renovate:config:check` 검증

### Task 6: 위험한/혼동되는 설정 정리

- [ ] `clean:all`이 lockfile 삭제를 수행하는 점을 제거하거나 legacy/dangerous로 명시
- [ ] `.github/` workflow는 canonical이 아님을 유지하되, 필요 시 archive/readme 문구 정리
- [ ] `docs/development/ci-cd.md`의 Dependabot historical section과 Renovate canonical section이 모순 없는지 재점검

## 제외 범위

- `npm audit fix --force`로 Next downgrade 또는 major downgrade/upgrade 수행
- 실 LLM/외부 유료 API 호출
- default CI에 full `npm audit` 상시 추가
- AI Engine major migration (`zod@4`, `pino@10`, `dotenv@17`, `@hono/node-server@2`) 즉시 적용
- Chart migration 완료 후 삭제된 `recharts` 복원

## 완료 기준

- [ ] root와 AI Engine 모두 `npm ls --depth=0`에서 의도치 않은 `extraneous`가 없다.
- [ ] AI Engine runtime audit의 Hono/node-server 직접 취약점이 해소된다.
- [ ] root Next audit은 강제 downgrade 없이 추적 상태로 문서화된다.
- [ ] Renovate가 root/AI Engine lockfile maintenance와 patch/minor PR을 관리한다.
- [ ] `clean:all`이 lockfile 운영 원칙과 충돌하지 않는다.
- [ ] 관련 문서와 TODO가 같은 dependency/config hygiene 정책을 가리킨다.
