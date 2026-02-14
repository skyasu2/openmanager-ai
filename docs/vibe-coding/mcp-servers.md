# MCP 서버 가이드

> Model Context Protocol로 AI 능력 확장 - 설치, 설정, 사용법 통합 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Reference
> Last reviewed: 2026-02-14
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

## 현재 사용 중인 MCP 서버 (7개)

| MCP | 용도 | 패키지 | 우선순위 |
|-----|------|--------|:--------:|
| **context7** | 라이브러리 공식 문서 | `@upstash/context7-mcp` | 높음 |
| **sequential-thinking** | 복잡한 추론, 아키텍처 설계 | `@modelcontextprotocol/server-sequential-thinking` | 높음 |
| **stitch** | Google Stitch AI UI 디자인 | `@_davideast/stitch-mcp` | 중간 |
| **supabase** | PostgreSQL 관리 | `@supabase/mcp-server-supabase` | 중간 |
| **vercel** | 배포 상태 확인 | `vercel-mcp` | 중간 |
| **playwright** | E2E 테스트, 브라우저 자동화 | `@playwright/mcp` | 중간 |
| **github** | 저장소/PR 관리 | `@modelcontextprotocol/server-github` | 중간 |

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
      "mcp__github__*",
      "mcp__sequential-thinking__*",
      "mcp__stitch__*"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "vercel", "supabase", "context7",
    "playwright", "github", "sequential-thinking", "stitch"
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
      "mcp__github__*",
      "mcp__sequential-thinking__*",
      "mcp__stitch__*"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "vercel", "supabase", "context7",
    "playwright", "github", "sequential-thinking", "stitch"
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

_Last Updated: 2026-02-14_
