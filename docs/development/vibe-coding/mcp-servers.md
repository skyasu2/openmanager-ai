# MCP 서버 가이드

> Model Context Protocol로 AI 능력 확장 - 설치, 설정, 사용법 통합 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Reference
> Last reviewed: 2026-04-24
> Canonical: docs/development/vibe-coding/mcp-servers.md
> Tags: vibe-coding,mcp,configuration

## 개요

**MCP (Model Context Protocol)**는 AI 에이전트에 외부 도구와 데이터를 연결하는 프로토콜입니다. OpenManager는 Codex, Claude Code, Gemini CLI가 같은 7개 project MCP 구성을 공유하되, 각 도구의 native config 형식은 유지합니다.

## 현재 MCP 카탈로그

> 현재 상시 등록: 7개 / 온디맨드: Storybook 1개

| MCP | 용도 | Claude `.mcp.json` | Gemini `.gemini/settings.json` | Codex `.codex/config.toml` |
|-----|------|:------------------:|:------------------------------:|:--------------------------:|
| `diagram-converter-mcp` / `diagram-converter` | Mermaid 렌더/검증 | ✅ | ✅ | ✅ |
| `supabase-db` | Supabase PostgreSQL 조회/SQL/마이그레이션 | ✅ | ✅ | ✅ |
| `vercel` | Vercel 배포/이벤트 조회 | ✅ | ✅ | ✅ |
| `playwright` | 브라우저 자동화/E2E | ✅ | ✅ | ✅ |
| `next-devtools` | Next.js dev runtime 진단 | ✅ | ✅ | ✅ |
| `chrome-devtools` | CDP 성능/네트워크/메모리/Lighthouse 진단 | ✅ | ✅ | ✅ |
| `github` | GitHub repo/PR/issue 조회 | ✅ | ✅ | ✅ |
| `storybook` | Storybook MCP | 온디맨드 | 온디맨드 | 온디맨드 |

제거된 상시 MCP: `context7`, `sequential-thinking`, standalone `lighthouse`, `stitch`. 필요 시 명시 요청 또는 전용 스크립트로만 사용합니다.

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
- GitHub MCP는 공식 HTTP endpoint `https://api.githubcopilot.com/mcp/`와 `GITHUB_PERSONAL_ACCESS_TOKEN` env placeholder를 사용합니다.

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

# project-scoped Codex wrapper
bash scripts/mcp/codex-local.sh mcp list

# health check
bash scripts/mcp/mcp-health-check-codex.sh
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe
bash scripts/mcp/mcp-health-check-codex.sh --probe supabase-db
```

현재 Codex 요약:

| Server ID | 실행 방식 | Timeout | 비고 |
|---|---|---:|---|
| `supabase-db` | `run-with-project-env.sh` → `start-supabase-mcp.sh` | `30/120` | `SUPABASE_ACCESS_TOKEN` runtime 주입 |
| `diagram-converter` | `start-node-mcp-package.sh diagram-converter-mcp 0.2.11 dist/index.js` | `120/180` | pinned |
| `playwright` | `start-node-mcp-package.sh @playwright/mcp 0.0.70 cli.js` | `60/180` | `DISPLAY=:0` |
| `next-devtools` | `start-node-mcp-package.sh next-devtools-mcp 0.3.10 dist/index.js` | `75/120` | Windows env 보강 |
| `chrome-devtools` | `start-node-mcp-package.sh chrome-devtools-mcp 0.23.0 ... --isolated` | `90/180` | `DISPLAY=:0` |
| `github` | HTTP MCP endpoint | `120/120` | bearer token env placeholder |
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

Gemini CLI는 tracked `.gemini/settings.json`을 사용합니다. user-scope `~/.gemini/settings.json`에는 OpenManager project MCP를 두지 않습니다.

확인:

```bash
gemini mcp list
```

현재 구조:

- `.gemini/settings.json`: project MCP 7개와 allowed list
- `~/.gemini/settings.json`: auth/ui/model 같은 user preference만 유지
- `.gemini/skills`: Gemini-only skill overlay만 허용. MCP 설정용으로 사용하지 않음

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

- 기본 모드: stdio
- 스크린샷 출력: `tmp/playwright/mcp/screenshots` 또는 `.playwright-mcp/screenshots`
- durable QA evidence가 필요하면 `reports/qa/evidence/`로 별도 승격합니다.
- Windows headed fallback이 필요하면 `npm run mcp:playwright:windows:enable`을 사용하고, 복구는 `npm run mcp:playwright:mode:stdio`를 사용합니다.

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
5. Gemini: `gemini mcp list`
6. Supabase live probe: `bash scripts/mcp/mcp-health-check-codex.sh --probe supabase-db`

### 토큰 누락

- `.mcp.json`에 토큰을 직접 쓰지 않습니다.
- `.env.local` 또는 shell env에 `SUPABASE_ACCESS_TOKEN`, `VERCEL_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`이 있는지 확인합니다.
- 로그/문서/리뷰에는 실제 토큰 값을 출력하지 않습니다.

### 느린 시작

- `bash scripts/mcp/install-node-mcp-cache.sh`로 pinned MCP package cache를 갱신합니다.
- cache audit은 앱 dependency audit과 분리해서 봅니다. MCP cache는 로컬 개발 도구 실행면입니다.
- 특정 MCP만 느리면 해당 server launcher를 직접 실행해 startup 오류를 분리합니다.

## 관련 문서

- [Skills](./skills.md)
- [AI 도구들](./multi-agent-tools.md)
- [설치 가이드](./setup.md)
- [AI Skill 운영 표준](../../guides/ai/skill-standards.md)
