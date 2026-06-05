# MCP 서버 가이드

> Model Context Protocol로 AI 능력 확장 - 설치, 설정, 사용법 통합 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Reference
> Last reviewed: 2026-05-23
> Canonical: docs/development/vibe-coding/mcp-servers.md
> Tags: vibe-coding,mcp,configuration

## 개요

**MCP (Model Context Protocol)**는 AI 에이전트에 외부 도구와 데이터를 연결하는 프로토콜입니다. OpenManager는 Codex, Claude Code, Gemini CLI가 공통 7개 project MCP 구성을 공유하고, Codex는 OpenAI 공식 문서 확인용 MCP를 1개 추가로 사용합니다. 각 도구의 native config 형식은 유지합니다.

## 현재 MCP 카탈로그

> 현재 상시 등록: 공통 7개 + Codex 전용 1개 / 온디맨드: Storybook 1개

| MCP | 용도 | Claude `.mcp.json` | Gemini `.gemini/settings.json` | Codex `.codex/config.toml` |
|-----|------|:------------------:|:------------------------------:|:--------------------------:|
| `diagram-converter-mcp` / `diagram-converter` | Mermaid 렌더/검증 | ✅ | ✅ | ✅ |
| `supabase-db` | Supabase PostgreSQL 조회/SQL/마이그레이션 | ✅ | ✅ | ✅ |
| `vercel` | Vercel 배포/이벤트 조회 | ✅ | ✅ | ✅ |
| `playwright` | 브라우저 자동화/E2E | ✅ | ✅ | ✅ |
| `next-devtools` | Next.js dev runtime 진단 | ✅ | ✅ | ✅ |
| `chrome-devtools` | CDP 성능/네트워크/메모리/Lighthouse 진단 | ✅ | ✅ | ✅ |
| `github` | GitHub repo/PR/issue 조회 | ✅ | ✅ | ✅ |
| `openaiDeveloperDocs` | OpenAI 공식 문서 조회 | ❌ | ❌ | ✅ |
| `storybook` | Storybook MCP | 온디맨드 | 온디맨드 | 온디맨드 |

제거된 상시 MCP: `context7`, `sequential-thinking`, standalone `lighthouse`, `stitch`. 필요 시 명시 요청 또는 전용 스크립트로만 사용합니다.

## 검색 MCP 도입 기준

`tavily`, `brave-search` 같은 외부 검색 MCP는 현재 상시 등록하지 않습니다. Codex 세션의 내장 웹 검색으로 최신 문서 확인, 출처 비교, 링크 기반 분석이 충분하고, 별도 MCP를 추가하면 API key 관리, 사용량 quota, startup surface가 늘어납니다.

도입 후보가 되는 경우:

- Claude/Gemini/Codex가 같은 검색 도구를 공유해야 하는 교차 에이전트 재현성이 필요함
- 단순 검색이 아니라 다중 URL extract/crawl, 도메인 필터, 검색 결과 JSON 계약이 작업 산출물에 직접 필요함
- 특정 QA/리서치 자동화에서 검색 호출량과 비용 한도를 명확히 통제할 수 있음

도입하지 않는 경우:

- 일반적인 최신 문서 확인, 공식 문서 인용, 제품/가격 비교 정도의 일회성 리서치
- Codex 웹 검색 결과로 충분히 출처 검증이 되는 분석
- 별도 API key를 `.env.local`에 추가해야 하지만 운영상 반복 사용 근거가 약한 경우

## 설정 파일 구조

| 파일 | 대상 | Git 추적 | 역할 |
|------|------|:--------:|------|
| `.mcp.json` | Claude Code | ✅ | project-scoped MCP server 목록. 시크릿은 placeholder/env/wrapper로 주입 |
| `.gemini/settings.json` | Gemini CLI | ✅ | project-scoped MCP server 목록과 allowed server list |
| `.codex/config.toml` | Codex CLI | ❌ | local runtime config. tracked template에서 생성 |
| `config/templates/codex.config.toml.template` | Codex bootstrap | ✅ | `.codex/config.toml` 생성 기준 |
| `.claude/settings.local.json` | Claude Code | ❌ | 로컬 권한/활성화 설정 |
| `.env.local` | 모든 로컬 도구 | ❌ | 실제 토큰/환경변수 |

원칙:

- MCP 설정 파일에는 실제 토큰을 커밋하지 않습니다.
- `.mcp.json`은 더 이상 gitignored secret 파일이 아닙니다. repo 공유 가능한 project config입니다.
- Vercel token은 `scripts/mcp/start-vercel-mcp.sh`가 `.env.local` 또는 shell env에서 읽어 실행 시점에만 전달합니다.
- Supabase token은 `scripts/mcp/run-with-project-env.sh`가 안전한 dotenv parser로 주입합니다.
- GitHub MCP는 공식 HTTP endpoint `https://api.githubcopilot.com/mcp/`와 `GITHUB_PERSONAL_ACCESS_TOKEN` env placeholder를 사용합니다. Codex는 HTTP MCP에 wrapper를 붙일 수 없으므로 `scripts/mcp/codex-local.sh`가 `.env.local` 또는 shell env의 MCP allowlist token만 Codex 프로세스 env로 주입합니다.

## MCP launcher 표준

Node 기반 MCP 서버는 user-scope cache를 우선 사용하고, 없으면 pinned `npx`로 fallback합니다.

```bash
# pinned package cache 설치/갱신
bash scripts/mcp/install-node-mcp-cache.sh

# allowlist 기반 launcher
bash scripts/mcp/start-node-mcp-package.sh <package> <version> <bin-path>

# Supabase 전용 launcher: 기존 dedicated install 우선, 없으면 pinned cache/fallback
bash scripts/mcp/run-with-project-env.sh bash scripts/mcp/start-supabase-mcp.sh

# Vercel 전용 launcher: VERCEL_API_KEY를 config에 직접 쓰지 않음
bash scripts/mcp/start-vercel-mcp.sh
```

허용된 pinned MCP package tuple은 [start-node-mcp-package.sh](../../../scripts/mcp/start-node-mcp-package.sh)에 정의합니다.

## Codex MCP 설정법

Codex MCP 서버 목록의 단일 기준은 `.codex/config.toml`의 `[mcp_servers.*]`입니다. 해당 파일은 local runtime 파일이므로 tracked template에서 생성합니다.

```bash
# project Codex config 생성/검증
bash scripts/mcp/setup-codex-project-config.sh --dry-run
bash scripts/mcp/setup-codex-project-config.sh
npm run codex:check

# project-scoped Codex wrapper
bash scripts/mcp/codex-local.sh mcp list

# health check
bash scripts/mcp/mcp-health-check-codex.sh
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe
bash scripts/mcp/mcp-health-check-codex.sh --probe supabase-db
```

Codex MCP는 project `.codex/config.toml`만 OpenManager 서버 목록을 보유합니다. `~/.codex/config.toml`은 개인 model/ui/project trust 같은 user preference만 유지하고, OpenManager `mcp_servers` 블록을 추가하지 않습니다. 중복이 남아 있으면 `bash scripts/ai/setup-codex-project-scope.sh`로 백업 격리 후 `npm run codex:check`를 실행합니다.

현재 Codex 요약:

| Server ID | 실행 방식 | Timeout | 비고 |
|---|---|---:|---|
| `supabase-db` | `run-with-project-env.sh` → `start-supabase-mcp.sh` | `30/120` | `SUPABASE_ACCESS_TOKEN` runtime 주입 |
| `diagram-converter` | `start-node-mcp-package.sh diagram-converter-mcp 0.2.11 dist/index.js` | `120/180` | pinned |
| `playwright` | `start-node-mcp-package.sh @playwright/mcp 0.0.70 cli.js --isolated --output-dir tmp/playwright/mcp/screenshots` | `60/180` | stdio 기본값, 동시 Claude/Codex 세션 간 Chrome profile 충돌 방지 |
| `next-devtools` | `start-node-mcp-package.sh next-devtools-mcp 0.3.10 dist/index.js` | `75/120` | Windows env 보강 |
| `chrome-devtools` | `start-node-mcp-package.sh chrome-devtools-mcp 0.23.0 ... --isolated` | `90/180` | `DISPLAY=:0` |
| `github` | HTTP MCP endpoint | `120/120` | `codex-local.sh`가 `GITHUB_PERSONAL_ACCESS_TOKEN` runtime 주입, token 없으면 auto mode에서 제외 |
| `openaiDeveloperDocs` | HTTP MCP endpoint | `60/120` | OpenAI 공식 문서 확인용 |
| `vercel` | `start-vercel-mcp.sh` | `180/120` | read-only deployment tools만 활성화 |

## Claude Code MCP 설정법

Claude Code는 tracked `.mcp.json`을 사용합니다. 현재 `.mcp.json`에는 7개 project MCP가 정의되어 있고, 실제 시크릿은 shell env 또는 `.env.local`에서 주입됩니다.

확인:

```bash
claude mcp list
```

기대 상태:

- project MCP 7개: `Connected`
- Claude.ai 개인 Google Calendar/Drive/Gmail connector: 인증하지 않았다면 `Needs authentication` 가능. 프로젝트 MCP 문제는 아닙니다.

권한은 `.claude/settings.local.json`에서 관리합니다. 이 파일은 로컬 전용이며 커밋하지 않습니다.

## Gemini MCP 설정법

Gemini CLI는 user-scope `~/.gemini/settings.json`과 tracked `.gemini/settings.json`을 모두 읽을 수 있습니다. OpenManager MCP는 repo-local `.gemini/settings.json`을 정본으로 두며, user-scope `~/.gemini/settings.json`에 OpenManager MCP를 병합하지 않습니다.

공식 문서 기준과 OpenManager 적용 판단:

| 공식 기준 | OpenManager 판단 |
|---|---|
| [Gemini CLI configuration](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)은 user settings가 모든 세션에 적용되고, project settings가 해당 project에서 user settings보다 우선한다고 설명합니다. | OpenManager 전용 MCP는 project scope가 맞습니다. 전역 user settings에는 개인 auth/ui/model preference만 둡니다. |
| [Gemini MCP add command](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html#adding-a-server-gemini-mcp-add)의 기본 scope는 `project`입니다. | 수동 추가가 필요한 경우도 기본값을 따라 project `.gemini/settings.json` 기준으로 처리합니다. |
| `mcpServers`는 `command`, `url`, `httpUrl`, `env`, `cwd`, `timeout`, `trust`, `includeTools`, `excludeTools`를 지원합니다. settings 문자열의 `$VAR_NAME` 또는 `${VAR_NAME}`은 로드 시 env로 해석됩니다. | 토큰은 settings에 실값으로 쓰지 않고 env placeholder 또는 launcher runtime env로 주입합니다. |
| [Gemini CLI extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)도 `mcpServers`를 제공할 수 있지만, 같은 이름이면 `settings.json`의 서버가 우선합니다. | OpenManager 7개 MCP는 extension이 아니라 project settings에서 관리합니다. extension은 배포 가능한 독립 패키지가 필요할 때만 검토합니다. |

확인:

```bash
npm run gemini:check
bash scripts/mcp/run-with-project-env.sh gemini mcp list --debug
```

현재 구조:

- `.gemini/settings.json`: project MCP 7개와 allowed list
- `~/.gemini/settings.json`: auth/ui/model 같은 Gemini user preference만 유지합니다. OpenManager MCP 7개는 이 파일에 두지 않습니다.
- `~/mcp_project_settings.json`: legacy 임시 파일입니다. 이 파일을 `~/.gemini/settings.json`에 병합하지 않습니다. 남아 있으면 `bash scripts/ai/setup-gemini-global.sh`가 백업 위치로 격리합니다.
- `.gemini/skills`: Gemini-only skill overlay만 허용. MCP 설정용으로 사용하지 않음
- GitHub HTTP MCP는 token env와 workspace trust가 필요합니다. `GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini mcp list --debug` 또는 project launcher `bash scripts/mcp/run-with-project-env.sh gemini ...`처럼 trust/no-relaunch 조건을 명시합니다. 직접 MCP 상태 하위명령은 headless trust/relaunch 차이로 `Disconnected`를 오판할 수 있습니다.

정리/검증:

```bash
OPENMANAGER_SKIP_MCP_CACHE_INSTALL=true bash scripts/ai/setup-gemini-global.sh
npm run gemini:check
GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini mcp list --debug
```

## 주요 도구 사용 기준

| MCP | 언제 쓰는가 | 최소 적용 순서 |
|---|---|---|
| `supabase-db` | 프로젝트/테이블 점검, SQL 실행 | `list_projects` → `list_tables` → 필요 시 `execute_sql` |
| `vercel` | 최신 배포/이벤트 확인 | `getDeployments` → `getDeployment` |
| `next-devtools` | Next.js 런타임 에러/라우트 진단 | `nextjs_index` → `nextjs_call(get_errors|get_routes)` |
| `chrome-devtools` | 성능/메모리/네트워크/Lighthouse 진단 | `new_page` → trace/Lighthouse/snapshot |
| `github` | PR/이슈/파일 조회 | list/read 중심, public snapshot push 경로 아님 |
| `playwright` | 실제 사용자 플로우 QA | `browser_navigate` → `browser_snapshot` → 상호작용 도구 |
| `diagram-converter` | Mermaid 렌더/검증 | `mermaid_render` |

## Playwright MCP

**현재 모드: Windows HTTP** (`url = "http://localhost:8931/mcp"`)

WSL2 환경에서 `DISPLAY=:0` stdio 모드는 transport 닫힘 오류가 발생합니다. Windows에서 MCP 서버를 실행하고 HTTP로 연결하는 방식을 기본으로 합니다.

### Windows MCP 서버 실행

```bash
# MCP 서버를 Windows PowerShell 창에서 백그라운드 시작
npm run mcp:playwright:windows:start
# (고정 버전: @playwright/mcp@0.0.55, 포트: 8931, 브라우저: msedge)

# config만 확인
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe

# Windows HTTP 서버 live probe
bash scripts/mcp/mcp-health-check-codex.sh --probe playwright
```

- Codex 세션은 **세션 시작 시** MCP config를 로드합니다. 서버를 띄운 뒤 세션을 (재)시작해야 playwright tool이 활성화됩니다.
- 고정 버전 `0.0.55`: 이 저장소의 Windows HTTP 경로에서 검증된 known-good 버전입니다. `@latest`는 npm 캐시/게시 상태 변화에 영향을 받으므로 기본 실행 경로에서는 고정합니다.

### 모드 전환

```bash
# stdio → windows-http (현재 기본)
npm run mcp:playwright:mode:windows    # config.toml만 변경
npm run mcp:playwright:windows:enable  # config 변경 + 서버 실행 한 번에

# windows-http → stdio (WSL DISPLAY=:0 환경 복구 시)
npm run mcp:playwright:mode:stdio
```

### 스크린샷 출력

- MCP 경로: `tmp/playwright/mcp/screenshots` 또는 `.playwright-mcp/screenshots`
- durable QA evidence가 필요하면 `reports/qa/evidence/`로 별도 승격합니다.

### Health Probe

`mcp-health-check-codex.sh`는 playwright live probe를 지원합니다 (`AVAILABLE_LIVE_PROBE_SERVERS` 포함).

- Windows HTTP 모드: MCP JSON-RPC `initialize` POST로 서버 버전 확인 (SDK 불필요)
- stdio 모드: live probe 미지원 (skip)

## Chrome DevTools MCP

역할 분담:

- Playwright MCP: 사용자 플로우/E2E 자동화
- Chrome DevTools MCP: 성능/CWV/메모리/네트워크/Lighthouse 진단

운영 기준:

- 기능 회귀/E2E: Playwright MCP 우선
- CLS/LCP/TTFB trace 진단: Chrome DevTools MCP 우선
- Accessibility/Best Practices/SEO 점수 감사: `lighthouse_audit`
- 메모리 누수/스냅샷 분석: `take_memory_snapshot`

headed 모드:

- Claude `.mcp.json`: `chrome-devtools-mcp ... --isolated`
- Gemini `.gemini/settings.json`: `--isolated --headless`
- Codex `.codex/config.toml`: `--isolated`

기존 Chrome 세션을 재사용해야 할 때만 `--browser-url http://127.0.0.1:9222` 방식으로 임시 변경합니다. 변경 후에는 원래 config로 되돌립니다.

## Next DevTools MCP

Next.js dev server runtime 진단에 사용합니다.

대표 흐름:

```text
nextjs_index
nextjs_call(port=<dev-port>, toolName="get_errors")
nextjs_call(port=<dev-port>, toolName="get_routes")
```

주의:

- `get_errors`, `get_page_metadata`는 브라우저가 해당 페이지에 접속해야 유효합니다.
- `nextjs_index` auto-discovery가 실패하면 dev server 실제 포트를 명시합니다.
- `browser_eval`이 session start에서 실패하면 browser automation은 direct Playwright MCP로 전환하고 `nextjs_call`만 사용합니다.

## Storybook MCP

Storybook MCP는 상시 등록하지 않습니다.

운영 원칙:

- Storybook 작업 전 dev server(`http://127.0.0.1:6006`)를 먼저 실행합니다.
- `.storybook/main.ts`의 `@storybook/addon-mcp` 설정을 유지합니다.
- 상태 점검 기본 지표는 `npm run storybook:build` 성공 여부입니다.

```bash
npm run storybook
npm run storybook:build
curl -I http://127.0.0.1:6006
```

## 토큰 발급 URL

| 서비스 | 발급 URL | 필요 권한 |
|--------|---------|----------|
| Vercel | https://vercel.com/account/tokens | deployment read |
| Supabase | https://supabase.com/dashboard/account/tokens | project/database 작업 범위 |
| GitHub | https://github.com/settings/tokens | repo/read 중심 |

## 트러블슈팅

### MCP 서버 연결 실패

1. JSON/TOML 구문 확인: `python3 -m json.tool .mcp.json`, `python3 -m json.tool .gemini/settings.json`
2. launcher 문법 확인: `bash -n scripts/mcp/start-*.sh scripts/mcp/run-with-project-env.sh`
3. Codex: `bash scripts/mcp/codex-local.sh mcp list`
4. Claude: `claude mcp list`
5. Gemini: `GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini mcp list --debug`
6. Supabase live probe: `bash scripts/mcp/mcp-health-check-codex.sh --probe supabase-db`
7. Playwright live probe: `bash scripts/mcp/mcp-health-check-codex.sh --probe playwright`
   - Windows MCP 서버가 실행 중이어야 합니다. 미실행 시 `npm run mcp:playwright:windows:start` 먼저 실행.

### 토큰 누락

- `.mcp.json`에 토큰을 직접 쓰지 않습니다.
- `.env.local` 또는 shell env에 `SUPABASE_ACCESS_TOKEN`, `VERCEL_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`이 있는지 확인합니다.
- Codex GitHub MCP는 직접 `codex` 대신 `bash scripts/mcp/codex-local.sh ...`로 시작해야 `.env.local`의 GitHub token이 HTTP MCP bearer env로 주입됩니다.
- GitHub token이 없을 때 GitHub MCP만 제외하려면 기본값인 `OPENMANAGER_GITHUB_MCP_MODE=auto`를 유지합니다. 강제로 끄려면 `OPENMANAGER_GITHUB_MCP_MODE=off`, 누락을 실패로 드러내려면 `OPENMANAGER_GITHUB_MCP_MODE=on`을 사용합니다.
- 로그/문서/리뷰에는 실제 토큰 값을 출력하지 않습니다.

### 느린 시작

- `bash scripts/mcp/install-node-mcp-cache.sh`로 pinned MCP package cache를 갱신합니다.
- cache audit은 앱 dependency audit과 분리해서 봅니다. MCP cache는 로컬 개발 도구 실행면입니다.
- 특정 MCP만 느리면 해당 server launcher를 직접 실행해 startup 오류를 분리합니다.

## 관련 문서

- [Skills](./skills.md)
- [AI 도구들](./multi-agent-tools.md)
- [설치 가이드](./setup.md)
- [Skills 레퍼런스](./skills.md)
