# Scripts 디렉토리

> Owner: team
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-04-10

프로젝트 자동화 및 유틸리티 스크립트 모음.

- 활성 여부 판단은 파일 존재가 아니라 `npm run artifacts:scripts:audit` 결과를 기준으로 합니다.
- 2026-04-10 기준 script liveness 분석은 [script-reference-audit-2026-04-10.md](../reports/docs/script-reference-audit-2026-04-10.md)에 기록합니다.

## 디렉토리 구조

```
scripts/
├── ai/                # AI 에이전트 도구
│   ├── agent-bridge.sh        # Claude ↔ Codex 브릿지
│   └── health/                # AI 도구 상태 체크
├── data/              # 데이터 파이프라인 엔트리포인트
│   ├── otel-fix.ts            # OTel 데이터 보정
│   └── otel-verify.ts         # OTel 데이터 검증
├── dev/               # 개발 도구
│   ├── biome-wrapper.sh       # Biome 포맷터 래퍼
│   ├── lint-changed.sh        # 변경 파일만 린트
│   ├── tsc-wrapper.js         # TypeScript 체크 래퍼
│   ├── typecheck-scope.js     # 증분 type-check 대상 파일 판정
│   └── typecheck-changed.sh   # 변경 감지 기반 증분 project 타입체크
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
├── stitch/            # Stitch MCP 검증
│   └── validate-stitch-registry.js
├── test/              # 테스트 헬퍼
│   ├── github-auth-helper.cjs
│   └── vercel-post-deploy-smoke.mjs
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
# 변경 감지 기반 증분 린트/타입체크 (빠른 피드백)
bash scripts/dev/lint-changed.sh
bash scripts/dev/typecheck-changed.sh

# 전체 TypeScript 체크
npm run type-check

# Biome 포맷팅
bash scripts/dev/biome-wrapper.sh
```

### Git / Release 유틸리티

```bash
# canonical release commit/tag 생성 후 GitLab main으로 push
npm run release:patch
git push gitlab --follow-tags

# public GitHub snapshot refresh
npm run sync:github

# GitHub PAT helper 사용 시 ENCRYPTION_KEY 필수
ENCRYPTION_KEY='long-random-passphrase' GITHUB_PAT=ghp_xxx \
  node scripts/test/github-auth-helper.cjs setup
```

- `scripts/release/publish.sh`: canonical release 경로만 지원합니다. GitHub release/tag 권위는 없습니다.
- `scripts/test/github-auth-helper.cjs`: 예외적 GitHub HTTPS push helper이며, `.github-auth.json` 사용 시 `ENCRYPTION_KEY`를 반드시 직접 지정해야 합니다.
- `scripts/test/tavily-key-loader.cjs`: plaintext `TAVILY_API_KEY`만 지원합니다. 과거 encrypted Tavily env/file 경로는 retire 되었고, 발견 시 명시적으로 실패합니다.

- `scripts/dev/tsc-wrapper.js`는 로컬 `typescript/bin/tsc`를 실행하며 `SIGINT`/`SIGTERM`/`SIGHUP`를 자식 프로세스로 전달한다.
- `TSC_WRAPPER_TIMEOUT_MS`를 주면 full type-check에도 opt-in timeout을 적용할 수 있고, `TSC_WRAPPER_KILL_GRACE_MS`로 SIGTERM 이후 강제 종료 grace period를 조정할 수 있다.
- local full type-check가 중단되면 wrapper가 종료 시그널/timeout과 경과 시간을 함께 출력해 orphan `tsc` 프로세스 진단을 돕는다.
- `scripts/dev/typecheck-scope.js`는 `src/**/*.ts(x)`뿐 아니라 `tsconfig*.json`, `package.json`, `scripts/dev/typecheck-*`, `scripts/dev/tsc-*` 패턴에 맞는 type-check 인프라 변경도 root type-check relevant로 간주한다.
- `scripts/dev/typecheck-changed.sh`는 `TYPECHECK_CHANGED_STATUS_FILE`에 `passed` / `soft-timeout` / `failed` / `timeout` / `skipped-no-relevant-ts` / `delegated-type-definition-only` 상태를 기록할 수 있다. changed-file filtering은 "전체 project type-check를 시작할지"만 판단하고, 실제 타입 검사는 `tsconfig.check.json` 전체 graph로 수행한다. `src/types/**` 단독 변경은 root type-check를 직접 돌리지 않고 위임하고, `scripts/dev/typecheck-*` / `scripts/dev/tsc-*` 같은 도구 스크립트 변경은 project graph 변경이 아니므로 quick smoke와 전용 테스트로 검증한다.
- `scripts/hooks/pre-push.js`는 `PRE_PUSH_MODE`를 지원한다. 기본 `fast`(정책 가드 only), `verify`(테스트+타입체크), `strict`(verify + runner/release advisory) 순으로 강도가 올라간다.
- Hook 구현 SSOT는 `scripts/hooks/pre-push.js`이며, 문서 정책/운영 흐름은 `docs/development/git-hooks-workflow.md`를 따른다.
- `scripts/dev/vitest-main-wrapper.js`는 zero-test DOM related 실행에서만 알려진 Vite dep-scan 노이즈를 억제한다. 조건은 `exit 0`, `No test files found`, `vite:dep-scan`의 outdated request 패턴이 모두 맞을 때뿐이라 실제 테스트 실패나 다른 경고는 숨기지 않는다.

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
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe
bash scripts/mcp/mcp-health-check-codex.sh --probe supabase-db
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe --json
bash scripts/mcp/mcp-health-report-codex.sh --no-live-probe
bash scripts/mcp/mcp-health-report-codex.sh --no-live-probe --allow-missing-codex --summary-file "$GITHUB_STEP_SUMMARY"
# GitHub Actions workflow_dispatch에서 run_codex_live_probe=true면 supabase-db live probe 실행

# JSON report에는 probeTargets / liveProbes metadata 포함
# - probeTargets: command, args, configuredTimeoutSec, timeoutSec, callTool, selected
# - liveProbes: 실행 결과(status/detail) + probe metadata + stage(readiness/tool-call/full/preflight)
# - summary-file 사용 시 비정상 live probe는 GitHub job summary의 Live Probe Issues 섹션에 표시
# - GitHub Actions artifact는 JSON + *-codex.log 패턴을 함께 업로드

# Storybook CI 빌드(비대화형, 타임아웃)
npm run storybook:build:ci
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

- `scripts/grafana/otlp-export.ts`의 기본 출력 경로는 `tmp/grafana/otlp-export`입니다.
- Grafana/OTLP 변환 결과처럼 재생성 가능한 로컬 산출물은 `scripts/` 아래에 보관하지 않습니다.
- 2026-04-10에 수동 login/OAuth/token/validation helper 5개를 제거했습니다. 자동 실행 경로에 붙지 않은 manual helper는 `scripts/`에 유지하지 않습니다.
- 같은 날 수동 SQL, 정적 Grafana dashboard asset, WSL 복구 스크립트 7개를 [legacy-scripts/2026-04-10](../reports/history/legacy-scripts/2026-04-10/README.md)로 archive했습니다.
- 같은 날 `pipeline-helpers.ts`와 `scripts/data/otel/*` helper 3개도 호출점 부재와 깨진 `./types` import를 근거로 제거했습니다.
- 현재 기준으로 `scripts/` audit의 unreferenced 후보는 `0`개입니다.

---

_Last reviewed: 2026-04-10_
