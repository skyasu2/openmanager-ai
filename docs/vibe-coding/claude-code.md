# Claude Code 마스터 가이드

> Anthropic의 공식 AI 코딩 CLI 도구
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/vibe-coding/claude-code.md
> Tags: vibe-coding,claude,mcp

## 개요

**Claude Code**는 터미널에서 실행되는 AI 페어 프로그래머입니다.

```bash
# 기본 실행
claude

# 모델 지정
claude --model opus      # Claude Opus (최강)
claude --model sonnet    # Claude Sonnet (균형)
claude --model haiku     # Claude Haiku (빠름)
```

## 핵심 기능

### 1. 대화형 코딩

```
You: 서버 메트릭 API에 캐싱 추가해줘
Claude: [코드 분석] → [계획 수립] → [구현] → [테스트]
```

### 2. 파일 조작

- **Read**: 파일 읽기
- **Write**: 파일 생성
- **Edit**: 파일 수정 (정밀한 diff)
- **Glob/Grep**: 파일 검색

### 3. 터미널 명령

```bash
# Claude가 bash 명령 실행
npm run test
git status
docker ps
```

### 4. 웹 검색/페치

```bash
# 최신 문서 참조
"Next.js 16 App Router 문서 확인해줘"
```

## Built-in Subagents

Claude Code는 전문 서브에이전트를 제공합니다.

| Agent | 용도 | 사용 시점 |
|-------|------|----------|
| **Explore** | 코드베이스 탐색 | "이 기능 어디 있어?" |
| **Plan** | 구현 계획 | 복잡한 기능 설계 |
| **general-purpose** | 범용 리서치 | 멀티스텝 조사 |

### 사용 예시

```
You: 에러 핸들링 코드 어디 있어?
Claude: [Explore 에이전트로 탐색]
        → src/lib/error-handler.ts 발견
```

## 슬래시 명령어

### 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 |
| `/clear` | 대화 초기화 |
| `/compact` | 컨텍스트 압축 |
| `/cost` | 토큰 사용량 |

### 커스텀 Skills

```bash
/commit              # 커밋
bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "변경분 리뷰"
/commit-push-pr      # 커밋 → 푸시 → PR
/lint-smoke          # 린트 + 테스트
```

## 효과적인 프롬프팅

### 좋은 예시

```
# 구체적, 범위 한정
"useServerStatus 훅에서 폴링 인터벌을 환경변수로 분리해줘"

# 컨텍스트 제공
"이 PR의 타입 에러 수정해줘. strict 모드 준수 필요"

# 단계별 요청
"1. 먼저 현재 구조 분석해줘
 2. 개선 방안 제안해줘
 3. 승인하면 구현해줘"
```

### 나쁜 예시

```
# 너무 광범위
"대시보드 만들어줘"

# 모호함
"이거 고쳐줘"

# 한 번에 너무 많이
"전체 앱 리팩토링해줘"
```

## 컨텍스트 관리

### CLAUDE.md

```markdown
# CLAUDE.md
프로젝트 개요, 규칙, 참조 파일 정의
→ Claude가 자동으로 읽음
```

### .claude/rules/

```
.claude/rules/
├── code-style.md      # any 금지, strict 모드
├── architecture.md    # 폴더 구조, SSOT
├── multi-agent-tools.md        # MCP, Skills 사용법
├── testing.md         # 테스트 전략
└── deployment.md      # 배포 규칙
```

### 컨텍스트 압축

```bash
# 대화가 길어지면
/compact

# 새 세션 시작
/clear
```

## 권한 관리

### settings.json

```json
{
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(git:*)",
      "mcp__context7__*",
      "Skill(commit)"
    ],
    "deny": [
      "Bash(rm -rf:*)"
    ]
  }
}
```

### 권한 패턴

```bash
Bash(command:*)      # 특정 명령어 허용
mcp__server__*       # MCP 서버 전체 허용
Skill(skill-name)    # 특정 스킬 허용
```

## 트러블슈팅

### 컨텍스트 초과

```
증상: "Context limit exceeded"
해결: /compact 또는 /clear
```

### 느린 응답

```
증상: 응답이 30초 이상
해결:
- 요청 범위 축소
- haiku 모델 사용
- /compact로 컨텍스트 줄이기
```

### 파일 수정 실패

```
증상: "Edit failed"
해결:
- 파일 먼저 읽기 요청
- 더 구체적인 위치 지정
- 수동 수정 후 재시도
```

## 고급 팁

### 1. Plan Mode 활용

```
"이 기능 구현 계획 먼저 세워줘"
→ Claude가 Plan 에이전트로 설계
→ 승인 후 구현
```

### 2. 병렬 작업

```
"lint와 type-check 동시에 실행해줘"
→ Claude가 병렬 실행
```

### 3. 배경 작업

```
"테스트 백그라운드로 실행하고 결과 알려줘"
→ Claude가 비동기 실행
```

### 4. 이미지 분석

```
"이 스크린샷 보고 UI 버그 찾아줘"
→ Claude가 이미지 분석
```

---

## 고급 설정

### 설정 파일 계층 구조

Claude Code는 여러 설정 파일을 사용하며, 우선순위가 있습니다:

```
~/.claude/settings.json          # 글로벌 설정
.claude/settings.json            # 프로젝트 공통 설정 (Git 추적)
.claude/settings.local.json      # 프로젝트 로컬 설정 (Git 제외)
.mcp.json                        # MCP 서버 실제 구성 (Git 제외)
```

| 파일 | 용도 | Git 추적 |
|------|------|:--------:|
| `settings.json` | Hooks, 출력 스타일 등 공유 설정 | ✅ |
| `settings.local.json` | 권한, MCP 활성화 등 로컬 설정 | ❌ |
| `.mcp.json` | MCP 서버 실제 토큰/경로 | ❌ |

### Hooks 설정

Claude Code는 도구 실행 전후에 자동 명령을 실행할 수 있습니다.

**settings.json 예시**:

```json
{
  "outputStyle": "color",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "./node_modules/.bin/biome format --write \"$(echo $CLAUDE_TOOL_INPUT | jq -r '.file_path')\" 2>/dev/null || true",
            "timeout": 10,
            "showOutput": false
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $(echo $CLAUDE_TOOL_INPUT | jq -r '.command' | head -c 200)\" >> logs/claude-bash-commands.log",
            "timeout": 5,
            "showOutput": false
          }
        ]
      }
    ]
  }
}
```

| Hook 타입 | 시점 | 사용 예시 |
|----------|------|----------|
| `PostToolUse` | 도구 실행 후 | 자동 포맷팅, 린트 |
| `PreToolUse` | 도구 실행 전 | 명령어 로깅, 검증 |

**환경 변수**:
- `$CLAUDE_TOOL_INPUT`: 도구 입력 JSON
- `$CLAUDE_FILE_PATHS`: 관련 파일 경로

### 권한 설정 상세

**settings.local.json**에서 세분화된 권한 관리:

```json
{
  "permissions": {
    "allow": [
      // 기본 명령어
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(gh:*)",

      // 파일 시스템
      "FileSystem(read:/project/**)",

      // 웹 접근
      "WebSearch",
      "WebFetch(domain:*.anthropic.com)",

      // Skills
      "Skill(commit)",
      "Skill(ai-code-review)",

      // MCP 서버
      "mcp__supabase__*",
      "mcp__context7__*"
    ],
    "deny": [
      "Bash(rm -rf:*)"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "supabase",
    "vercel",
    "github"
  ]
}
```

**권한 패턴 문법**:

| 패턴 | 설명 | 예시 |
|------|------|------|
| `Bash(cmd:*)` | 특정 명령어 허용 | `Bash(npm:*)` |
| `Bash(ENV=val:*)` | 환경변수 포함 명령 | `Bash(NODE_ENV=test:*)` |
| `mcp__server__*` | MCP 서버 전체 | `mcp__context7__*` |
| `mcp__server__tool` | 특정 도구만 | `mcp__github__list_issues` |
| `Skill(name)` | 특정 스킬 | `Skill(commit)` |
| `WebFetch(domain:*)` | 도메인 허용 | `WebFetch(domain:github.com)` |

### Custom Commands

`.claude/commands/` 디렉토리에 커스텀 슬래시 명령어 정의:

```
.claude/commands/
├── bridge-note.md    # 브리지 요청 템플릿
└── my-command.md     # /my-command 명령어
```

**예시 (bridge-note.md)**:

```markdown
# /bridge-note 명령어

브리지 스크립트로 검증 요청을 실행합니다.

## 실행 내용
1. `bash scripts/ai/agent-bridge.sh --to codex --mode analysis --save-auto "..."`
2. `logs/ai-bridge/notes/` 최신 결과 확인
3. 요약 표시
```

### MCP 서버 활성화

**enabledMcpjsonServers** 설정으로 프로젝트별 MCP 서버 활성화:

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "context7",
    "supabase",
    "vercel",
    "playwright",
    "github",
    "sequential-thinking"
  ]
}
```

실제 MCP 서버 구성은 `.mcp.json`에 정의:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_..."
      }
    }
  }
}
```

---

## 관련 문서

- [AI 도구들](./multi-agent-tools.md)
- [MCP 서버](./mcp-servers.md)
- [Skills](./skills.md)
- [워크플로우](./workflows.md)
