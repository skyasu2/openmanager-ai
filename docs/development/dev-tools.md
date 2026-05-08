# 개발 도구

> 프로젝트에서 사용하는 개발 도구 및 설정
> Owner: dev-experience
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-08
> Canonical: docs/development/dev-tools.md
> Tags: tooling,nodejs,biome

## 런타임 & 패키지

### Node.js

```bash
# 버전 확인
node -v  # v24.x (Active LTS)

# .nvmrc 파일로 자동 전환
echo "24" > .nvmrc
nvm use
```

### npm

```bash
npm -v  # 11.x

# 유용한 명령어
npm run dev:network    # 개발 서버
npm run build          # 프로덕션 빌드
npm run validate:all   # 전체 검증
npm run test:quick     # 빠른 테스트
```

- 루트/AI Engine 모두 `package.json`의 `engines` / `devEngines`로 `Node 24.x + npm 11.x` 기준선을 명시합니다.
- 루트 설치는 더 이상 전역 `legacy-peer-deps` 우회에 의존하지 않습니다. peer 충돌은 lockfile/override로 해결합니다.

## 코드 품질 도구

### Biome (Lint + Format)

```bash
# 린트 실행
npm run lint

# 자동 수정
npm run lint:fix

# 설정 파일
biome.json
```

- 루트는 `@biomejs/biome` 단일 도구로 lint/format을 처리합니다.
- `scripts/dev/biome-wrapper.sh`를 통해 로컬, CI, 훅 경로에서 같은 엔트리포인트를 재사용합니다.
- `ESLint + Prettier` 조합보다 설정면적과 실행 시간이 작아 빠른 로컬 피드백 루프에 유리합니다.
- 트레이드오프: `eslint-plugin-*` 생태계의 깊은 아키텍처 전용 규칙은 그대로 가져올 수 없으므로, 필요한 정책은 TypeScript/테스트/커스텀 스크립트로 보완합니다.

### TypeScript

```bash
# 타입 체크
npm run type-check

# strict 모드 활성화 (tsconfig.json)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Knip (Unused Code Hygiene)

```bash
npm run knip
npm run knip:ci
npm run knip:fix
```

- `Knip`은 unused dependency뿐 아니라 export, 파일, 타입 노출까지 함께 추적합니다.
- 대규모 리팩터링 전후, release 전 정리, dead surface 제거 시 신뢰할 수 있는 기준선으로 사용합니다.
- 트레이드오프: 정적 분석 기반이라 runtime reflection이나 동적 import 패턴은 false positive가 날 수 있으므로, 삭제 전에는 코드/테스트 증거를 함께 확인해야 합니다.

## 테스트 도구

### Vitest (Unit/Integration)

```bash
npm run test           # 전체 테스트
npm run test:quick     # 빠른 테스트
npm run test:coverage  # 커버리지
npm run test:external-connectivity # 외부 연동 통합(선택)
npm run test:cloud-contract         # Cloud Run 계약 통합(선택)
npm run vitals:integration        # web-vitals 통합(느린 테스트, 선택)
```

### Playwright (E2E)

```bash
npm run test:e2e           # 로컬 E2E
npm run test:e2e:critical  # 핵심 테스트만
npm run test:e2e:mobile    # 모바일 반응형 회귀 (mobile 프로젝트만)
npm run test:e2e:responsive # 데스크톱+모바일 통합 회귀
```

### Next.js 로컬 API QA 주의사항

`next dev` 기준으로 일부 **중첩 App Router API route**가 로컬에서 `404`를 반환할 수 있습니다.

- 확인 일시: `2026-03-16`
- 로컬 `nextjs_index` 기준 route 목록에는 존재하지만, 실제 요청은 `_not-found` HTML로 응답할 수 있음
- 재현 예:
  - `/api/ai/supervisor`
  - `/api/ai/supervisor/stream/v2`
  - `/api/ai/jobs`
  - `/api/servers/next`
  - `/api/ai/incident-report`
  - `/api/security/csp-report`

반대로 아래처럼 **1-depth API**는 같은 로컬 세션에서 정상 응답이 확인되었습니다.

- `/api/system`
- `/api/health`
- `/api/database`
- `/api/csrf-token`
- `/api/error-report`

운영 기준:

- 중첩 App Route API의 로컬 `404`는 **즉시 제품 회귀로 판정하지 않음**
- AI 경로/릴리즈 게이트는 기존 원칙대로 **Vercel + Playwright MCP**를 우선 사용
- 로컬에서는 `vitest` 계약 테스트와 route unit test를 먼저 확인
- route별 원인 분석 전에 `next dev` 자체가 `/api/version`에 응답하는지 먼저 확인
- 이를 위해 `npm run dev:readiness`, `npm run dev:readiness:webpack` 스크립트를 사용
- probe 결과에서 `000`은 route 존재 여부가 아니라 **dev server 미응답 / compile 지연**으로 해석

> **버그 수정 (`2026-03-16`)**: 초기 스크립트가 `npm run dev -- --port $PORT`를 사용해
> `next dev -p 3000 --port $PORT`로 실행됐고, Next.js가 포트 3000으로 바인딩하면서
> probe가 동적 포트를 체크해 HTTP 000이 발생했음.
> 현재는 `node_modules/.bin/next dev --port $PORT`를 직접 호출하도록 수정됨.
> 이후 `curl` 실패를 `000000`으로 오인하는 후속 버그와 `SIGKILL` cleanup로 `.next/dev/lock`을 남기던 문제도 수정됨.

> **재확인 (`2026-03-16`)**:
> - `npm run dev:readiness` (Turbopack): `/api/version` 준비 완료까지 약 `96s`
> - Turbopack 준비 후 spot-check: `/api/ai/jobs`, `/api/ai/supervisor`, `/api/ai/supervisor/stream/v2` 모두 `non-404`
> - `npm run dev:readiness:webpack`: 서버 자체는 `Ready in ~60-70s`를 출력하지만, 첫 요청에서 `proxy` 후 target route compile이 길게 이어짐
> - `--path=/`, `--path=/api/health`, `--path=/api/version` 모두 `120s` timeout이 재현됨
> - webpack 로그 공통 패턴: `✓ Ready in ...` -> `○ Compiling proxy ...` -> `○ Compiling <target-path> ...`
> - `npm run dev:probe:webpack -- --path=/` 재검증에서도 `server ready 72s`, 이후 첫 요청 `120s timeout`, 로그 `Compiling proxy -> Compiling /` 확인
> - 따라서 현재 로컬 dev 이슈는 **중첩 route 404**보다는 **webpack 경로의 첫 요청 compile / readiness 지연**에 더 가깝다
>
> **재확인 (`2026-05-08`)**:
> - WSL2 `/mnt/d` + ext4 `node_modules` symlink 조합에서는 Turbopack이 cross-filesystem symlink 제약으로 불안정하므로 기본 `dev*` 스크립트는 `--webpack`을 사용한다.
> - `src/data/otel-data/index.ts`의 서버 전용 `node:*` dynamic import는 webpack client build가 정적 처리하지 않도록 `webpackIgnore`를 유지한다.
> - 검증 기준: `npm run dev:readiness:webpack -- --path=/api/version`, 그리고 `/dashboard` 첫 요청 HTTP 200.

로컬 production-like 검증이 필요한 경우 아래 스모크 스크립트를 사용합니다.

### next dev readiness probe

`next dev`가 실제로 준비 상태에 들어가는지 먼저 확인합니다.
중첩 route 404 조사 전에 선행해야 하는 체크입니다.
준비 확인 후 1-depth/2-depth route를 spot-check해 404 여부를 출력합니다.

```bash
npm run dev:readiness
npm run dev:readiness:webpack

# 타임아웃 조정 (WSL2 콜드 스타트가 느릴 경우)
NEXT_DEV_READY_TIMEOUT_S=120 npm run dev:readiness

# 개별 옵션
bash scripts/dev/check-next-dev-readiness.sh --timeout=60
bash scripts/dev/check-next-dev-readiness.sh --webpack --timeout=60
```

### webpack first-request probe (진단 전용)

> **결론 (`2026-05-08`)**: 현재 WSL2 `/mnt/d` 로컬 개발 표준은 `next dev --webpack`이다.
> ext4 내부 repo처럼 cross-filesystem symlink가 없는 환경에서 Turbopack 진단이 필요할 때만 `npm run dev:readiness` 또는 `npm run dev:trace:turbopack`를 별도로 실행한다.
> webpack 첫 요청은 여전히 `Compiling proxy → Compiling <route>` 때문에 ready 이후 추가 대기가 필요할 수 있다.
> 미사용 dev rewrites(`/test-tools/*`, `/dev/*`)는 proxy 컴파일 경로 단순화를 위해 제거됨.

`next dev --webpack`에서 **서버 ready 시점**과 **첫 요청 응답 시점**을 분리해서 측정합니다.
webpack 첫 요청 지연이 route 문제인지 compile 지연인지 구분할 때 사용합니다.

```bash
npm run dev:probe:webpack -- --path=/
npm run dev:probe:webpack -- --path=/api/health

# 개별 옵션
bash scripts/dev/check-next-webpack-first-request.sh --path=/api/version --ready-timeout=120 --request-timeout=120
```

출력 항목:

- `server ready in ...` : webpack dev 서버가 Ready 로그를 찍기까지의 wall-clock
- `first-request http=... wall=...` : 첫 요청 자체의 응답 시간
- `proxy-log`, `target-log` : 로그에 `Compiling proxy`, `Compiling <path>`가 찍혔는지
- 종료 코드: `0` = 첫 요청 응답 확보, `1` = `404` 또는 `000 timeout` 재현

운영 메모:

- `404`는 route 누락으로 보고 실패 처리
- `000`은 route 결함이 아니라 **첫 요청 compile timeout / webpack 특성**으로 해석
- 종료 시 `.next/dev/types`를 정리해 후속 `npm run type-check` 오염을 방지

### Turbopack trace 수집

Turbopack compile 지연 원인을 실제 trace 파일로 남깁니다.
Next.js 공식 문서 기준으로 `NEXT_TURBOPACK_TRACING=1`을 사용하며, trace 파일은 `.next/dev/trace-turbopack`에 생성됩니다.

```bash
npm run dev:trace:turbopack

# 타임아웃/대상 route 조정
NEXT_DEV_TRACE_TIMEOUT_S=180 npm run dev:trace:turbopack
bash scripts/dev/collect-next-dev-trace.sh --path=/api/version --timeout=180

# 생성 후 해석
npx next internal trace .next/dev/trace-turbopack
```

운영 메모:

- trace 수집은 **Turbopack 전용**입니다. webpack 지연 원인 분리는 별도 최소 재현이 필요합니다.
- trace 수집 전에는 `npm run dev:readiness`로 기본 준비 시간을 먼저 확인하는 편이 낫습니다.
- `2026-03-16` 검증 기준으로 `NEXT_DEV_TRACE_TIMEOUT_S=150 npm run dev:trace:turbopack`가 성공했고, `.next/dev/trace-turbopack` 파일(`~3.4MB`)이 생성됨
- 같은 날 재검증 기준으로 trace 재수집도 성공했고, 최신 `.next/dev/trace-turbopack` 크기는 약 `69.8MB`
- readiness/trace 스크립트는 종료 시 `.next/dev/types`를 정리해 이후 `npm run type-check`가 깨진 dev route 타입에 오염되지 않게 함

### 로컬 API 스모크 (`local:smoke`)

`next build` + `next start` 기반으로 nested route 404를 검증합니다.
`next dev`에서만 재현되는 오탐을 걸러내는 목적입니다.
서버 준비 판정은 기본적으로 경량 endpoint인 `/api/version`을 사용합니다.

```bash
# production build(.next/BUILD_ID)가 이미 있으면 스킵 (빠름)
npm run local:smoke

# 강제 재빌드 후 검증 (느림, ~2~3분)
npm run local:smoke:rebuild

# 개별 옵션
bash scripts/dev/local-api-smoke.sh --port=3099 --timeout=10

# 준비 대기 상향이 필요할 때
LOCAL_SMOKE_READY_TIMEOUT_S=90 bash scripts/dev/local-api-smoke.sh
```

검사 항목:

| 구분 | 경로 | 기대 결과 |
|------|------|----------|
| Baseline | `/api/health` | 200 |
| Baseline | `/api/system`, `/api/csrf-token`, `/api/database` | non-404 |
| Nested (주의) | `/api/ai/supervisor` | non-404 |
| Nested (주의) | `/api/ai/supervisor/stream/v2` | non-404 |
| Nested (주의) | `/api/ai/jobs`, `/api/servers/next` | non-404 |
| Nested (주의) | `/api/ai/incident-report`, `/api/security/csp-report` | non-404 |

> **판정 기준**: `404` = route 미존재(실패), `4xx/5xx` = route 존재하나 인증·메서드 오류(정상)

이 메모는 로컬 dev 서버의 관찰 결과를 기록한 것이며, Vercel production 동작을 대체하지 않습니다.

### Lighthouse (성능 점수 자동 측정)

- 대화형 단건 진단은 `chrome-devtools MCP`의 `lighthouse_audit`를 우선 사용합니다.
- 반복 측정/배치 리포트는 아래 CLI 스크립트를 사용합니다.

```bash
npm run lighthouse:local   # 로컬 빌드/서버 기동 후 mobile+desktop 점수 자동 측정
npm run lighthouse:vercel  # Vercel URL 대상으로 mobile+desktop 점수 자동 측정
npm run lighthouse:score -- --url https://openmanager-ai.vercel.app --preset mobile --runs 3
```

### Storybook (Component Docs)

스토리북 운영 주체는 **Claude Code**를 기본으로 사용합니다.

```bash
# 개발 미리보기 서버
npm run storybook

# CI/상태 확인 기준
npm run storybook:build

# CI 안정화 빌드 (비대화형 + 타임아웃)
npm run storybook:build:ci
# 타임아웃 조정 (초 단위, 기본 900)
STORYBOOK_BUILD_TIMEOUT_SEC=480 npm run storybook:build:ci

# 빠른 기동 스모크(동적 포트, 비대화형)
npm run storybook:smoke

# 실행 중 응답 확인
curl -I http://127.0.0.1:6006
```

`storybook:smoke`는 Storybook 공식 CLI의 `--ci`, `--smoke-test`, `--force-build-preview`, `--disable-telemetry`, `--no-version-updates` 조합을 사용합니다.
이 조합은 비대화형 기동 확인, preview 재빌드, telemetry/update check 차단을 동시에 보장합니다.

GitLab CI에서는 Storybook/UI 관련 변경에 한해 `validate_storybook_smoke` job이 `npm run storybook:smoke`를 실행합니다. Full build는 기본 validate에 포함하지 않고, Storybook 설정 변경, 대규모 UI/story 변경, release 전 정적 산출물 확인이 필요할 때 `npm run storybook:build:ci`를 수동 실행합니다.

WSL2 `/mnt/*` Windows 파일시스템 위에서는 Vite/esbuild native IO가 `SIGBUS`를 낼 수 있습니다. 로컬에서 `storybook:smoke`가 해당 증상으로 실패하면 제품 회귀로 단정하지 말고, Linux ext4 경로 또는 GitLab runner 작업 경로(`~/builds/...`)에서 재검증합니다.

```bash
# Codex/Gemini에서 Storybook 작업이 필요할 때
bash scripts/ai/agent-bridge.sh --to claude --mode query "스토리북 실행/점검 진행"
```

#### 프레임워크 선택: `@storybook/nextjs-vite`

`react-vite` 대신 `nextjs-vite`를 사용하는 이유:

- Next.js App Router의 `useRouter`, `useSearchParams`, `usePathname` 등 내비게이션 훅을 **내장 mock으로 자동 지원** — 커스텀 mock 파일 불필요
- `next/image`, `next/link`, `next/dynamic` 등 Next.js 특수 컴포넌트를 별도 설정 없이 렌더링 가능
- `preview.ts`에서 `nextjs: { appDirectory: true }` 명시 불필요 (App Router가 기본값)

#### navigation mock 설계: `queryEntries`

query 상태를 `Record<string, string>` 대신 `Array<[string, string]>` 튜플 배열로 관리하는 이유:

- `?tag=a&tag=b` 처럼 동일 키 중복값을 `Record`는 마지막 값만 보존 → 손실 발생
- `URLSearchParams` 생성자가 튜플 배열을 직접 수락 — 변환 없이 전달 가능
- `useSearchParams()` 반환값이 실제 Next.js 동작과 동일한 중복 키 의미론 유지

#### AI가 수정 시 주의할 설정 (회귀 방지)

| 항목 | 올바른 설정 | 잘못된 변형 |
|------|------------|-------------|
| storybook 실행 명령 | `storybook dev -p 6006` | `node node_modules/storybook/dist/bin/dispatcher.js dev -p 6006` |
| 패키지 버전 기준 (2026-03-15) | `storybook@^10.2.10`, `@storybook/nextjs-vite@^10.2.10`, `@storybook/addon-vitest@^10.2.10` | npm 미배포 버전 지정 (`^10.2.19` 등) |
| addon-mcp 버전 | `@storybook/addon-mcp@^0.2.3` (npm 공개 최신) | 존재하지 않는 버전 지정 (`^0.3.3`, `^0.4.2`) |
| query 타입 | `Array<[string, string]>` | `Record<string, string>` |
| framework 설정 | `@storybook/nextjs-vite` | `@storybook/react-vite` (Next.js mock 미지원) |

> **배경**: 2026-03-15 Codex가 nextjs-vite 마이그레이션 중 (1) storybook 명령을 `node_modules` 직접 경로로 변경, (2) 패키지 버전을 임의 수정한 이력이 있음. 이후 `storybook/@storybook/nextjs-vite/@storybook/addon-vitest`의 `^10.2.19` 및 `addon-mcp`의 `^0.3.3`를 지정하려다 npm `ETARGET/E404`가 발생했다. 2026-05-07 재점검에서도 `addon-mcp@0.4.2`가 registry에서 조회되지 않아 `^0.2.3`으로 되돌렸다. 위 표의 패턴을 의도적으로 유지할 것.

## Git Hooks

### Husky + Custom Hook Scripts

운영 흐름과 예시 출력은 [Git Hooks 워크플로우 가이드](./git-hooks-workflow.md)를 SSOT로 봅니다. 이 섹션은 도구/엔트리포인트 요약만 다룹니다.

```bash
# pre-commit: 시크릿 스캔 + Biome(staged)
# post-commit: 커밋 완료 알림(비차단)
# pre-push: fast(기본)=정책 가드 only, verify/strict에서만 테스트+TypeScript
```

핵심 구현 파일:

```bash
.husky/pre-commit
.husky/post-commit
.husky/pre-push
scripts/env/precommit-check-secrets.cjs
scripts/hooks/pre-push.js
scripts/hooks/post-commit.js
```

- 운영 정책과 모드 선택 기준은 [Git Hooks 워크플로우 가이드](./git-hooks-workflow.md)를 따릅니다.
- 구현 디테일과 wrapper 동작은 [scripts/README.md](../../scripts/README.md) 를 참조합니다.

## 2026 Tooling 포지셔닝

이 저장소의 도구 선택은 "유행하는 최신 도구를 붙였다"보다, **AI 보조 개발에서 피드백 루프를 줄이는 방향**에 가깝습니다. 범용 표준 조합과 비교하면 아래와 같습니다.

| 영역 | 현재 선택 | 흔한 대안 | 이 저장소에 맞는 이유 | 트레이드오프 |
|------|-----------|-----------|----------------------|--------------|
| Lint/Format | `Biome` | `ESLint + Prettier` | Rust 기반 단일 도구라 로컬/CI/훅 모두 빠르게 수렴 | ESLint 플러그인 생태계를 그대로 쓰기 어렵다 |
| Unit/Integration Test | `Vitest` | `Jest` | ESM/병렬 실행/빠른 watch loop가 Next.js 프론트엔드와 잘 맞음 | 오래된 Jest 전용 가이드나 matcher 자산은 바로 재사용하기 어렵다 |
| Browser QA | `Playwright` | `Cypress` | 다중 탭, 브라우저 외부 제어, MCP 연동으로 Vercel 실환경 QA와 연결하기 쉽다 | trace/screenshot artifact 관리 비용이 커질 수 있다 |
| Dead Code Hygiene | `Knip` | `depcheck` 또는 수동 정리 | 패키지 수준을 넘어 export/file/type dead surface까지 추적 | 동적 로딩 패턴은 수동 확인이 필요하다 |
| Push Gate | change-aware custom pre-push | `husky + lint-staged` 정도 | 문서/아티팩트/no-op/type/test 범위를 나눠 필요한 검증만 실행 | 스크립트 유지보수 난도가 일반 훅보다 높다 |

정리하면, 이 스택은 **엔터프라이즈급 품질 게이트를 유지하면서도 로컬 속도를 해치지 않도록 최적화된 구성**입니다. 다만 "모든 프로젝트의 정답"은 아니며, 현재처럼 Next.js + 멀티 에이전트 + GitLab/Vercel + QA 기록 자동화가 결합된 저장소에서 특히 효과가 큽니다.

## Docker

> 상세 가이드: [Docker 개발 환경](./docker.md)

Docker는 **AI Engine (Cloud Run) 전용**입니다. Frontend 개발에는 불필요합니다.

```bash
# AI Engine 로컬 테스트 (Docker Compose)
cd cloud-run
docker compose up --build        # 빌드 + 실행
docker compose logs -f ai-engine # 로그 확인
docker compose down              # 종료

# Supabase 로컬 실행 (내부적으로 Docker 사용)
npx supabase start

# 프로덕션 배포 (GCP Cloud Build, 로컬 Docker 불필요)
cd cloud-run/ai-engine
./deploy.sh
```

## 버전 관리

### commit-and-tag-version

```bash
npm run release:patch   # 8.0.0 → 8.0.1
npm run release:minor   # 8.0.0 → 8.1.0
npm run release:major   # 8.0.0 → 9.0.0
npm run release:dry-run # 미리보기
npm run release:check   # 버전/태그/체인지로그 정합성 점검
```

### CHANGELOG

자동 생성: `CHANGELOG.md`

## IDE 설정

### VS Code / Cursor 설정

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 필수 확장

| 확장 | 용도 |
|------|------|
| Biome | 린트/포맷 |
| Tailwind CSS IntelliSense | CSS 자동완성 |
| GitLens | Git 히스토리 |
| Error Lens | 인라인 에러 표시 |
| Pretty TypeScript Errors | TS 에러 가독성 |

### 권장 확장

| 확장 | 용도 |
|------|------|
| Thunder Client | API 테스트 |
| Database Client | DB 뷰어 |
| Docker | 컨테이너 관리 |

## 환경변수 관리

### 파일 구조

```
.env.example      # 템플릿 (Git 추적)
.env.local        # 로컬 개발 (Git 무시)
.env.production   # 프로덕션 (Git 무시)
```

### 주요 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY= # 레거시 fallback
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers
CEREBRAS_API_KEY=
MISTRAL_API_KEY=
GROQ_API_KEY=

# Cloud Run
CLOUD_RUN_AI_URL=
```

## Cloud Run AI Engine 직접 접근 (WSL)

로컬 WSL 환경에서 Claude Code / Codex 등의 도구가 production Cloud Run API를 직접 호출할 수 있습니다.

### 인증 구조

```
Cloud Run: --allow-unauthenticated (GCP IAM 불필요)
    ├─ /health, /warmup, /ready  → 인증 없이 접근 가능
    └─ /api/*                    → x-api-key 헤더 필수 (CLOUD_RUN_API_SECRET)
```

### 기본 접근 패턴

```bash
# 환경 변수 로드 (.env.local은 신뢰 가능한 로컬 파일로 가정)
set -a
source /mnt/d/dev/openmanager-ai/.env.local >/dev/null 2>&1
set +a

AI_ENGINE_URL="${CLOUD_RUN_AI_URL:-https://ai-engine-490817238363.asia-northeast1.run.app}"

# 헬스 체크 (인증 불필요)
curl -s "${AI_ENGINE_URL}/health" | jq .

# legacy graph runtime 410 shim 확인
curl -s \
  -H "x-api-key: ${CLOUD_RUN_API_SECRET}" \
  "${AI_ENGINE_URL}/api/ai/graphrag/stats" | jq .

# AI 응답 직접 테스트
curl -s \
  -H "x-api-key: ${CLOUD_RUN_API_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Redis 메모리 부족 해결법"}],"enableRAG":true}' \
  "${AI_ENGINE_URL}/api/ai/supervisor"
```

### 주요 엔드포인트

| 엔드포인트 | 인증 | 용도 |
|------------|:----:|------|
| `GET /health` | 없음 | 서비스 상태 + provider 활성 여부 |
| `POST /api/ai/supervisor` | 필요 | AI 응답 end-to-end 테스트 |
| `GET /api/ai/graphrag/stats` | 필요 | **410 반환** — legacy graph runtime shim, replacement: Knowledge Retrieval Lite |
| `GET /api/ai/graphrag/related/:id` | 필요 | **410 반환** — legacy graph runtime shim, replacement: `searchKnowledgeBase` |
| `POST /api/ai/graphrag/extract` | 필요 | **410 반환** — legacy graph runtime shim, replacement: `searchKnowledgeBase` |

> 현재 내부 지식 검색은 `/api/ai/supervisor` 요청에서 `enableRAG: true`와 `searchKnowledgeBase` 도구를 통해 검증합니다. `/api/ai/graphrag/*`는 런타임 검색 API가 아니라 제거된 graph runtime의 명시적 호환 경계입니다.

### Claude Code / Codex에서 활용

- **Claude Code**: Bash tool로 `curl` 직접 실행 가능
- **Codex**: WSL 터미널에서 동일한 curl 명령 사용
- **Playwright MCP**: `/health` 브라우저 접근 가능, API 호출은 curl 우선

> **주의**: `CLOUD_RUN_API_SECRET`은 `.env.local`에만 존재하며 Git에 포함되지 않습니다. AI 도구가 이 값을 로그/응답에 출력하지 않도록 주의하고, `grep | cut` 같은 단순 파싱 대신 환경 변수 로드를 우선하세요.

## 관련 문서

- [프로젝트 설정](./project-setup.md)
- [Vibe Coding](./vibe-coding/README.md)
