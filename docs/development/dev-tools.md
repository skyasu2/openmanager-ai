# 개발 도구

> 프로젝트에서 사용하는 개발 도구 및 설정
> Owner: dev-experience
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-03-15
> Canonical: docs/development/dev-tools.md
> Tags: tooling,nodejs,biome

## 런타임 & 패키지

### Node.js

```bash
# 버전 확인
node -v  # v24.x

# .nvmrc 파일로 자동 전환
echo "24" > .nvmrc
nvm use
```

### npm

```bash
npm -v  # 10.9.2

# 유용한 명령어
npm run dev:network    # 개발 서버
npm run build          # 프로덕션 빌드
npm run validate:all   # 전체 검증
npm run test:quick     # 빠른 테스트
```

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
- `2026-03-16` 추가 확인 기준으로 현재 워크스페이스에서는 `Turbopack 기본`과 `--webpack` 모두 `/api/version` 20초 내 응답을 주지 못해, route-specific 404 재현은 아직 확정되지 않음

로컬 production-like 검증이 필요한 경우 아래 스모크 스크립트를 사용합니다.

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
| addon-mcp 버전 | `@storybook/addon-mcp@^0.2.3` (npm 공개 최신) | 존재하지 않는 버전 지정 (`^0.3.3`) |
| query 타입 | `Array<[string, string]>` | `Record<string, string>` |
| framework 설정 | `@storybook/nextjs-vite` | `@storybook/react-vite` (Next.js mock 미지원) |

> **배경**: 2026-03-15 Codex가 nextjs-vite 마이그레이션 중 (1) storybook 명령을 `node_modules` 직접 경로로 변경, (2) 패키지 버전을 임의 수정한 이력이 있음. 이후 `storybook/@storybook/nextjs-vite/@storybook/addon-vitest`의 `^10.2.19` 및 `addon-mcp`의 `^0.3.3`를 지정하려다 npm `ETARGET/E404`가 발생했다. 위 표의 패턴을 의도적으로 유지할 것.

## Git Hooks

### Husky + Custom Hook Scripts

```bash
# pre-commit: 시크릿 스캔 + Biome(staged)
# post-commit: 커밋 완료 알림(비차단)
# pre-push: TypeScript + 빠른 테스트 (환경 검사는 STRICT_PUSH_ENV=true일 때만)
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

### standard-version

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

## 관련 문서

- [프로젝트 설정](./project-setup.md)
- [Vibe Coding](./vibe-coding/README.md)
