# MCP 서버 가이드

> Model Context Protocol로 AI 능력 확장 - 설치, 설정, 사용법 통합 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Reference
> Last reviewed: 2026-02-19
> Canonical: docs/vibe-coding/mcp-servers.md
> Tags: vibe-coding,mcp,configuration

## 개요

**MCP (Model Context Protocol)**는 Claude Code에 외부 도구와 데이터를 연결하는 프로토콜입니다.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Claude Code │ ←→  │ MCP Server  │ ←→  │ External    │
│             │     │             │     │ Service     │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 현재 사용 중인 MCP 서버 (9개)

| MCP | 용도 | 패키지 | 우선순위 |
|-----|------|--------|:--------:|
| **context7** | 라이브러리 공식 문서 | `@upstash/context7-mcp` | 높음 |
| **sequential-thinking** | 복잡한 추론, 아키텍처 설계 | `@modelcontextprotocol/server-sequential-thinking` | 높음 |
| **stitch** | Google Stitch AI UI 디자인 | `@_davideast/stitch-mcp` | 중간 |
| **supabase** | PostgreSQL 관리 | `@supabase/mcp-server-supabase` | 중간 |
| **vercel** | 배포 상태 확인 | `vercel-mcp` | 중간 |
| **playwright** | E2E 테스트, 브라우저 자동화 | `@playwright/mcp` | 중간 |
| **next-devtools** | Next.js 런타임 오류/로그/메타데이터 조회 | `next-devtools-mcp` | 중간 |
| **github** | 저장소/PR 관리 | `@modelcontextprotocol/server-github` | 중간 |
| **storybook** | 컴포넌트 문서 조회, 스토리 기반 작업 (Claude Code 전담 운영) | `@storybook/addon-mcp` (Storybook MCP) | 중간 |

---

## 설정 파일 구조

### 파일 위치 및 우선순위

```
~/.claude/settings.json           # 글로벌 설정 (모든 프로젝트)
.claude/settings.json             # 프로젝트 공용 설정 (Git 추적)
.claude/settings.local.json       # 프로젝트 로컬 설정 (Git 제외) ← 권한
.mcp.json                         # MCP 서버 실제 구성 (Git 제외) ← 토큰
```

| 파일 | 용도 | Git 추적 |
|------|------|:--------:|
| `.claude/settings.json` | Hooks, 출력 스타일 | ✅ |
| `.claude/settings.local.json` | 권한, MCP 활성화 목록 | ❌ |
| `.mcp.json` | MCP 서버 실제 토큰/경로 | ❌ |

### 현재 적용된 설정 방식

**Pragmatic 방식** (현재 프로젝트):
- `.mcp.json` 파일에 직접 토큰 저장
- `.gitignore`로 파일 보호
- 장점: 한눈에 설정 파악, WSL 환경변수 문제 해결
- 단점: 파일 유출 시 보안 위험

**Best Practice** (참고용):
- 환경변수로 토큰 분리
- `claude mcp add` CLI 사용
- 장점: 보안성, 이식성
- 단점: 설정 복잡, WSL 환경변수 누락 이슈

---

## Codex MCP 설정법 (프로젝트 SSOT)

### 적용 원칙

- Codex MCP 서버 목록의 단일 기준(SSOT)은 `.codex/config.toml`의 `[mcp_servers.*]`입니다.
- 하드코딩 목록 대신 설정 파일에서 서버 목록을 파싱합니다.
- 설정 변경 후 최소 점검:
  - `bash scripts/mcp/codex-local.sh mcp list`
  - `bash scripts/mcp/mcp-health-check-codex.sh`
- 실제 동작 검증은 서버별 도구 1회 이상 호출로 확인합니다.

### 현재 Codex MCP 구성 요약 (2026-02-15)

| Server ID | 실행 방식(요약) | Timeout (startup/tool) | 적용 목적 |
|---|---|---:|---|
| `supabase-db` | `node .../mcp-server-supabase/dist/transports/stdio.js` | `30/120` | DB 조회/SQL/마이그레이션 |
| `context7` | `npx -y @upstash/context7-mcp` | `60/120` | 최신 공식 문서 검색 |
| `playwright` | `npx -y @playwright/mcp --output-dir .playwright-mcp/screenshots` | `60/180` | 브라우저 자동화 QA |
| `next-devtools` | `npx -y next-devtools-mcp@latest` | `75/120` | Next.js 런타임 진단 |
| `github` | `npx -y @modelcontextprotocol/server-github` | `60/120` | PR/Issue/파일 조회 |
| `sequential-thinking` | `npx -y @modelcontextprotocol/server-sequential-thinking` | `60/90` | 복잡한 추론/계획 |
| `stitch` | `bash -lc ./scripts/mcp/start-stitch-mcp.sh` | `120/180` | UI 생성/변형 |
| `vercel` | `bash -lc npx -y vercel-mcp ...` | `60/120` | 배포 상태/로그 확인 |

### Codex에 MCP 추가/수정하는 방법

1. `.codex/config.toml`의 `[mcp_servers.<name>]` 블록을 추가/수정합니다.
1. 민감값은 평문 노출 금지 원칙으로 관리하고, 문서/리뷰/로그에는 반드시 마스킹합니다.
1. 변경 후 Codex 세션을 재시작합니다.
1. 상태 점검:
```bash
bash scripts/mcp/codex-local.sh mcp list
bash scripts/mcp/mcp-health-check-codex.sh
```
1. 서버별 최소 1회 도구 호출로 실동작을 확인합니다.

### GitHub MCP 토큰 자동 동기화 (2026-02-17)

- `scripts/mcp/codex-local.sh`와 `scripts/mcp/mcp-health-check-codex.sh`는 실행 전에 `scripts/mcp/sync-github-mcp-auth.sh`를 자동 호출합니다.
- 동기화 대상: `.env.local`의 `GITHUB_PERSONAL_ACCESS_TOKEN` (없으면 `GITHUB_TOKEN`) → `.codex/config.toml`의 `[mcp_servers.github.env]`.
- 토큰이 이미 같으면 파일을 변경하지 않습니다.
- `.env.local` 또는 토큰이 없으면 경고만 출력하고 기존 설정으로 계속 진행합니다.
- 필요 시 수동 실행:

```bash
bash scripts/mcp/sync-github-mcp-auth.sh
```

### Playwright MCP (현재 의도된 동작 기준)

- 기본 모드: `stdio` (Codex에서 직접 실행)
- 현재 설정 핵심:
  - `--output-dir .playwright-mcp/screenshots`
  - `DISPLAY=:0` (WSL GUI 브라우저 표시 환경)
- Windows Headed 모드가 필요하면:
```bash
npm run mcp:playwright:windows:enable
```
- 다시 기본 stdio로 복구:
```bash
npm run mcp:playwright:mode:stdio
```

### 다른 MCP 목록과 적용 방법 (Codex 기준)

| MCP | 언제 쓰는가 | 최소 적용 순서(예시) |
|---|---|---|
| `context7` | 라이브러리/프레임워크 최신 문서 확인 | `resolve-library-id` → `query-docs` |
| `supabase-db` | 프로젝트/테이블 점검, SQL 실행 | `list_projects` → `list_tables` → 필요 시 `execute_sql` |
| `vercel` | 최신 배포/이벤트 확인 | `getDeployments` → `getDeployment` |
| `next-devtools` | Next.js 런타임 에러/라우트 진단 | `nextjs_index` → `nextjs_call(get_errors|get_routes)` |
| `github` | PR/이슈/파일 조회 및 자동화 | `list_pull_requests` 또는 `get_file_contents` |
| `sequential-thinking` | 다단계 설계/리팩토링 분석 | `sequentialthinking` 1회 이상 호출 |
| `stitch` | UI 시안 생성/화면 변형 | `list_projects` → `generate_screen_from_text` |
| `playwright` | 실제 사용자 플로우 QA | `browser_navigate` → `browser_snapshot` → 상호작용 도구 |

---

## 현재 설정 백업 (2026-02-14 Updated)

### .mcp.json 구조

```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "vercel-mcp", "VERCEL_API_KEY=<your-token>"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "<your-token>"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    },
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "stitch": {
      "command": "npx",
      "args": ["-y", "@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_USE_SYSTEM_GCLOUD": "1",
        "STITCH_PROJECT_ID": "<your-gcp-project-id>"
      }
    }
  }
}
```

### .claude/settings.local.json 권한 설정

```json
{
  "permissions": {
    "allow": [
      "mcp__context7__*",
      "mcp__supabase__*",
      "mcp__vercel__*",
      "mcp__playwright__*",
      "mcp__next-devtools__*",
      "mcp__github__*",
      "mcp__sequential-thinking__*",
      "mcp__stitch__*",
      "mcp__storybook__*"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "vercel", "supabase", "context7",
    "playwright", "next-devtools", "github", "sequential-thinking", "stitch", "storybook"
  ]
}
```

---

## 토큰 발급 URL

| 서비스 | 발급 URL | 필요 권한 |
|--------|---------|----------|
| **Vercel** | https://vercel.com/account/tokens | - |
| **Supabase** | https://supabase.com/dashboard/account/tokens | - |
| **GitHub** | https://github.com/settings/tokens | `repo`, `read:org` |

---

## 각 서버별 상세

### Context7 (문서 검색) - 우선순위: 높음

라이브러리 공식 문서 검색, 최신 API 레퍼런스.

**주요 도구**:
```bash
mcp__context7__resolve-library-id("next.js")     # 라이브러리 ID 조회
mcp__context7__query-docs("/vercel/next.js", "App Router")  # 문서 검색
```

**사용 예시**:
```
You: "Next.js 16 Server Actions 문서 확인해줘"
Claude: [context7로 최신 문서 검색] → 공식 문서 기반 답변
```

---

### Sequential Thinking (추론) - 우선순위: 높음

단계별 문제 해결, 복잡한 리팩토링 계획, 아키텍처 설계.

**사용 예시**:
```
You: "이 모듈을 마이크로서비스로 분리하는 방법 분석해줘"
Claude: [sequential-thinking으로 단계별 분석]
        → Step 1: 의존성 분석
        → Step 2: 경계 식별
        → Step 3: 분리 계획
```

---

### Stitch (UI 디자인) - 우선순위: 중간

Google Stitch AI로 UI 디자인 생성, Figma 연동.

**사전 요구사항**:
- gcloud CLI 설치 및 인증
- GCP 프로젝트에 Stitch API 활성화

**설치**:
```bash
# Stitch API 활성화
gcloud services enable stitch.googleapis.com --project=YOUR_PROJECT_ID

# 상태 확인
npx @_davideast/stitch-mcp doctor
```

**사용 예시**:
```
You: "로그인 페이지 UI 디자인해줘"
Claude: [stitch로 UI 생성] → Figma로 복사 가능
```

**환경변수**:
- `STITCH_USE_SYSTEM_GCLOUD`: 시스템 gcloud 사용 (1)
- `STITCH_PROJECT_ID`: GCP 프로젝트 ID

---

### Supabase (데이터베이스) - 우선순위: 중간

SQL 실행, 마이그레이션 관리, 테이블 조회.

**주요 도구**:
```bash
mcp__supabase__execute_sql("SELECT * FROM servers LIMIT 10")
mcp__supabase__list_tables()
mcp__supabase__apply_migration("add_index", "CREATE INDEX...")
```

---

### Vercel (배포) - 우선순위: 중간

배포 상태 확인, 프로젝트 관리, 로그 조회.

**주요 도구**:
```bash
mcp__vercel__getDeployments()
mcp__vercel__getDeployment("deployment-id")
```

---

### Playwright (E2E) - 우선순위: 중간

브라우저 자동화, 스크린샷 캡처, 테스트 실행.

**주요 도구**:
```bash
mcp__playwright__browser_navigate("http://localhost:3000")
mcp__playwright__browser_snapshot()      # 접근성 트리
mcp__playwright__browser_click("Login button", "ref123")
mcp__playwright__browser_take_screenshot()
```

**WSL + Windows GUI 모드 (브라우저 창 표시)**:
```bash
# 1) Codex Playwright MCP를 HTTP 모드로 전환 + Windows MCP 서버 실행
npm run mcp:playwright:windows:enable

# 2) Codex 세션 재시작 후 확인
bash scripts/mcp/codex-local.sh mcp list
```

복구(기본 stdio 모드):
```bash
npm run mcp:playwright:mode:stdio
```

---

### Next DevTools (Next.js 런타임 진단) - 우선순위: 중간

Vercel 공식 MCP. Next.js 16+ 내장 `/_next/mcp` 엔드포인트와 통신하여 런타임 진단 제공.

**외부 도구 (7개)**:

| 도구 | Dev Server 필요 | 용도 |
|------|:---:|------|
| `init` | - | 세션 초기화 |
| `nextjs_docs` | - | Next.js 문서 검색 (**context7과 중복, context7 우선**) |
| `nextjs_index` | Y | dev server 탐색, 런타임 도구 목록 |
| `nextjs_call` | Y | 런타임 도구 실행 (아래 참조) |
| `upgrade_nextjs_16` | - | 업그레이드 가이드 + codemod |
| `enable_cache_components` | - | Cache Components 설정 |
| `browser_eval` | - | Playwright 래핑 (**playwright MCP와 중복, playwright 우선**) |

**런타임 도구 (`nextjs_call`로 호출, 6개)**:

| 도구 | 브라우저 세션 필요 | 기능 |
|------|:---:|------|
| `get_errors` | Y | 빌드/런타임/타입 에러 실시간 조회 |
| `get_project_metadata` | - | 프로젝트 경로, dev server URL |
| `get_routes` | - | 전체 App Router 라우트 목록 |
| `get_logs` | - | dev server 로그 파일 경로 |
| `get_page_metadata` | Y | 현재 페이지 구성 파일 (layout, error, page 등) |
| `get_server_action_by_id` | - | Server Action ID → 소스 파일/함수명 역추적 |

**고유 가치**: `nextjs_index` + `nextjs_call` 런타임 진단만 다른 MCP로 대체 불가

**사용 예시**:
```bash
# 1. dev server 실행 중 에러 확인
nextjs_index → nextjs_call(port=3000, toolName="get_errors")

# 2. 라우트 구조 파악
nextjs_call(port=3000, toolName="get_routes")

# 3. 브라우저 의존 도구는 Playwright로 페이지 먼저 열기
playwright__browser_navigate("http://localhost:3000/dashboard")
→ nextjs_call(port=3000, toolName="get_page_metadata")
```

**주의사항**:
- `get_errors`, `get_page_metadata`는 브라우저가 해당 페이지에 접속해야 동작
- `get_logs`는 경로만 반환 → 파일을 직접 읽어야 함
- dev server 시작에 ~100초 소요 (WSL 환경)

---

### GitHub (저장소) - 우선순위: 중간

PR 생성/관리, 이슈 관리, 파일 조회.

**주요 도구**:
```bash
mcp__github__create_pull_request(...)
mcp__github__list_issues("owner", "repo")
mcp__github__list_pull_requests("owner", "repo")
mcp__github__get_file_contents("owner", "repo", "path")
```

---

### Storybook (컴포넌트 문서/미리보기) - 우선순위: 중간

스토리북 운영은 **Claude Code 전담**으로 관리합니다.

Codex/Gemini에서 Storybook 작업이 필요하면 `agent-bridge.sh --to claude`로 위임합니다.

**운영 원칙**:
- Storybook MCP 사용 전 dev server(`http://127.0.0.1:6006`)를 먼저 실행
- `.storybook/main.ts`에 `@storybook/addon-mcp` 설정을 유지
- 상태 점검 기본 지표는 `storybook:build` 성공 여부
- `--smoke-test`는 Storybook `10.2.x`에서 포트 관련 오류가 발생할 수 있어 보조 지표로 사용

**권장 명령**:
```bash
# 1) dev server 실행 (Claude Code 운영)
npm run storybook

# 2) 정적 빌드 검증 (CI/문서화 기준)
npm run storybook:build

# 3) dev server 응답 확인 (실행 중일 때)
curl -I http://127.0.0.1:6006
```

**브리지 호출 예시**:
```bash
bash scripts/ai/agent-bridge.sh --to claude --mode query "스토리북 실행 후 상태 확인 및 기본 스토리 점검"
```

---

## 신규 설정 가이드

### 1. .mcp.json 생성

프로젝트 루트에 `.mcp.json` 파일 생성 후 위의 설정 백업 내용을 복사하고 토큰 입력.

### 2. .claude/settings.local.json 생성

```bash
mkdir -p .claude
cat > .claude/settings.local.json << 'EOF'
{
  "permissions": {
    "allow": [
      "mcp__context7__*",
      "mcp__supabase__*",
      "mcp__vercel__*",
      "mcp__playwright__*",
      "mcp__next-devtools__*",
      "mcp__github__*",
      "mcp__sequential-thinking__*",
      "mcp__stitch__*",
      "mcp__storybook__*"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "vercel", "supabase", "context7",
    "playwright", "next-devtools", "github", "sequential-thinking", "stitch", "storybook"
  ]
}
EOF
```

### 3. .gitignore 확인

```gitignore
.mcp.json
.mcp.json.backup*
.claude/settings.local.json
```

### 4. 확인

Claude Code 실행 후:
```
You: "MCP 서버 상태 확인해줘"
Claude: [context7, supabase 등 사용 가능 여부 표시]
```

---

## 트러블슈팅

### MCP 서버 연결 실패

```
증상: "MCP server not available"
해결:
1. .mcp.json 파일 존재 및 JSON 구문 확인
2. 토큰 값 확인
3. 의존성 설치: npm install
4. claude --debug로 로그 확인
```

### WSL 환경변수 누락

```
증상: 환경변수 기반 설정 동작 안 함
해결:
1. .mcp.json에 직접 토큰 입력 (Pragmatic 방식)
2. 또는 .bashrc에 export 추가 후 source ~/.bashrc
```

### 느린 응답

```
증상: MCP 호출이 10초 이상
해결:
1. 쿼리 범위 축소
2. 불필요한 MCP 비활성화 (enabledMcpjsonServers 수정)
```

---

## 관련 문서

- [Claude Code](./claude-code.md)
- [AI 도구 설치](./setup.md) - Claude Code, Codex, Gemini 설치
- [Skills](./skills.md)
- [워크플로우](./workflows.md)

---

_Last Updated: 2026-02-19_
