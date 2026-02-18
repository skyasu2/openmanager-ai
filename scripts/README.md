# Scripts 디렉토리

> Owner: team
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-16

프로젝트 자동화 및 유틸리티 스크립트 (53개 파일, 16개 디렉토리).

## 디렉토리 구조

```
scripts/
├── ai/                # AI 에이전트 도구
│   ├── agent-bridge.sh        # Claude ↔ Codex 브릿지
│   └── health/                # AI 도구 상태 체크
├── data/              # 데이터 파이프라인 & SQL
│   ├── otel/                  # OpenTelemetry 변환
│   ├── otel-fix.ts            # OTel 데이터 보정
│   ├── otel-verify.ts         # OTel 데이터 검증
│   └── *.sql                  # Supabase 테이블/함수
├── dev/               # 개발 도구
│   ├── biome-wrapper.sh       # Biome 포맷터 래퍼
│   ├── lint-changed.sh        # 변경 파일만 린트
│   ├── tsc-wrapper.js         # TypeScript 체크 래퍼
│   └── typecheck-changed.sh   # 변경 파일만 타입 체크
├── diagnostics/       # 디버깅 도구
│   └── claude-json-sanitize.js
├── docs/              # 문서 품질 관리
│   ├── check-docs.sh          # 문서 품질 점검
│   ├── doc-budget-report.js   # 문서 예산 리포트
│   ├── check-internal-links.js
│   ├── generate-inventory.js
│   └── lint-changed.sh
├── env/               # 환경변수 & 보안
│   ├── check-env.ts           # 환경변수 검증
│   ├── check-hardcoded-secrets.js
│   ├── precommit-check-secrets.cjs
│   └── sync-vercel.sh         # Vercel 환경변수 동기화
├── generators/        # 데이터 생성기
│   ├── generate-hourly-failure-scenarios.ts
│   └── generate-server-data.ts
├── hooks/             # Git hooks
│   ├── post-commit.js
│   ├── pre-push.js
│   └── validate-parallel.js   # 수동 병렬 검증 유틸(현재 pre-push 기본 경로 미사용)
├── mcp/               # MCP 서버 관련
│   ├── codex-local.sh         # 프로젝트 스코프 Codex 래퍼
│   ├── count-codex-mcp-usage.sh
│   ├── mcp-health-check-codex.sh
│   └── resolve-runtime-env.sh
├── setup/             # 셸 환경 설정
│   └── .bashrc_claude_additions
├── stitch/            # Stitch MCP 검증
│   └── validate-stitch-registry.js
├── supabase/          # Supabase 유지보수
│   └── cleanup-unused-tables.sql
├── test/              # 테스트 헬퍼
│   ├── diagnose-login-error.cjs
│   ├── github-auth-helper.cjs
│   ├── supabase-token-setup.cjs
│   └── verify-oauth-config.cjs
├── validation/        # 검증 도구
│   └── create-summary.sh
├── wsl/               # WSL 환경 설정
│   └── fix-wsl-config.ps1
├── generate-pwa-icons.mjs     # PWA 아이콘 생성
└── update-hourly-data-scenarios.ts
```

## 주요 스크립트

### AI 에이전트 브릿지

```bash
# Claude → Codex 프롬프트 전달
bash scripts/ai/agent-bridge.sh --to codex "프롬프트"
```

### 개발 워크플로우

```bash
# 변경 파일만 린트/타입체크 (빠른 피드백)
bash scripts/dev/lint-changed.sh
bash scripts/dev/typecheck-changed.sh

# Biome 포맷팅
bash scripts/dev/biome-wrapper.sh
```

### 문서 관리

```bash
# 문서 품질 점검 + 예산 리포트
bash scripts/docs/check-docs.sh
node scripts/docs/doc-budget-report.js
```

### 환경변수

```bash
# 환경변수 검증
npx tsx scripts/env/check-env.ts

# Vercel 동기화
bash scripts/env/sync-vercel.sh
```

### MCP 도구

```bash
# Codex MCP 래퍼 (프로젝트 스코프)
bash scripts/mcp/codex-local.sh

# Storybook MCP 포함 실행 (storybook dev 서버가 살아있을 때 자동 포함)
OPENMANAGER_STORYBOOK_MCP_MODE=auto bash scripts/mcp/codex-local.sh

# MCP 상태 점검
bash scripts/mcp/mcp-health-check-codex.sh
```

### 데이터 파이프라인

```bash
# OTel 데이터 보정 + 검증
npm run data:fix
npm run data:verify
npm run data:precomputed:build

# 레거시 생성기 실행 (명시적 허용 필요)
ALLOW_LEGACY_HOURLY_DATA=true npx tsx scripts/generators/generate-hourly-failure-scenarios.ts
ALLOW_LEGACY_PUBLIC_SERVER_DATA=true npx tsx scripts/generators/generate-server-data.ts
```

---

_Last reviewed: 2026-02-16_
