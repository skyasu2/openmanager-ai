# 개발 도구

> 프로젝트에서 사용하는 개발 도구 및 설정
> Owner: dev-experience
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-28
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
```

### Storybook (Component Docs)

스토리북 운영 주체는 **Claude Code**를 기본으로 사용합니다.

```bash
# 개발 미리보기 서버
npm run storybook

# CI/상태 확인 기준
npm run storybook:build

# 실행 중 응답 확인
curl -I http://127.0.0.1:6006
```

```bash
# Codex/Gemini에서 Storybook 작업이 필요할 때
bash scripts/ai/agent-bridge.sh --to claude --mode query "스토리북 실행/점검 진행"
```

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
