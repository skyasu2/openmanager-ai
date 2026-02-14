# AI 도구 설치 가이드

> Claude Code, Codex, Gemini 설치 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Tutorial
> Last reviewed: 2026-02-14
> Canonical: docs/vibe-coding/setup.md
> Tags: vibe-coding,setup,mcp

## 개요

Vibe Coding에 필요한 AI CLI 도구들의 설치 방법입니다.

```
┌─────────────────────────────────────────────────────────┐
│                    설치 순서                             │
├─────────────────────────────────────────────────────────┤
│  1. Claude Code  →  2. MCP 서버  →  3. Codex/Gemini    │
│     (메인 AI)         (확장 기능)      (코드 리뷰)       │
└─────────────────────────────────────────────────────────┘
```

> **MCP 서버 설정**은 [MCP 서버 가이드](./mcp-servers.md)를 참조하세요.

---

## 1. Claude Code 설치

### Native Installer (권장)

> **Note**: NPM 설치 방식은 **Deprecated** 되었습니다. Native Installer를 사용하세요.

```bash
# macOS / Linux (WSL 포함)
curl -fsSL https://claude.ai/install.sh | sh
```

**Native Installer 특징**:
- Node.js 불필요 (독립 실행형 바이너리)
- **자동 백그라운드 업데이트**
- WSL2 샌드박싱 지원

### Homebrew (macOS 대안)

```bash
brew install anthropic/tap/claude-code
```

### NPM (Deprecated)

```bash
# ⚠️ Deprecated - 기존 설치자만 사용
npm install -g @anthropic-ai/claude-code

# NPM → Native 마이그레이션
claude install
```

### 로그인 (OAuth)

```bash
# 최초 실행 시 브라우저 로그인
claude

# 브라우저가 열리면 Anthropic 계정으로 로그인
# 로그인 완료 후 터미널로 돌아옴
```

**Note**: API 키가 아닌 **브라우저 로그인** 방식입니다.

### 확인

```bash
claude --version   # 버전 확인
claude doctor      # 설치 유형(Native/NPM), 상태 점검
claude             # 대화형 모드 시작
```

---

## 2. MCP 서버 설치

> **상세 가이드**: [MCP 서버 가이드](./mcp-servers.md) 참조

### 빠른 설정

1. **`.mcp.json` 생성**: [MCP 서버 가이드 - 설정 백업](./mcp-servers.md#현재-설정-백업-2026-01-27) 참조

2. **권한 설정**: `.claude/settings.local.json` 생성

### 현재 사용 중인 MCP 서버 (8개)

| MCP | 용도 |
|-----|------|
| context7 | 라이브러리 문서 |
| sequential-thinking | 복잡한 추론 |
| stitch | Google UI 디자인 |
| supabase | PostgreSQL 관리 |
| vercel | 배포 상태 |
| playwright | E2E 테스트 |
| github | 저장소/PR 관리 |
| next-devtools | Next.js DevTools 컨텍스트/오류 조회 |

---

## 3. Codex CLI 설치 (코드 리뷰)

### 설치

```bash
# npm으로 설치
npm install -g @openai/codex
```

### 로그인 (OAuth)

```bash
# 최초 실행 시 브라우저 로그인
codex

# 브라우저가 열리면 OpenAI 계정으로 로그인
# Pro/Plus 구독 필요
```

**Note**: API 키가 아닌 **브라우저 로그인** 방식입니다.

### 확인

```bash
codex --version
```

---

## 4. Gemini CLI 설치 (코드 리뷰)

### 설치

```bash
# npm으로 설치
npm install -g @google/gemini-cli
```

### 로그인 (OAuth)

```bash
# 최초 실행 시 브라우저 로그인
gemini

# 브라우저가 열리면 Google 계정으로 로그인
```

**Note**: API 키가 아닌 **브라우저 로그인** 방식입니다.

### 자동화/브리지 실행 권장 (WSL)

```bash
# 비대화형(스크립트/브리지) 호출은 API 키 권장
export GEMINI_API_KEY=your_api_key

# 예시: OpenManager 브리지 호출
bash scripts/ai/agent-bridge.sh --to gemini "다른 설명 없이 HELLO_FROM_GEMINI 만 출력"
```

OAuth만 사용하는 경우 비대화형 호출에서 인증 프롬프트를 처리할 수 없어 실패할 수 있습니다.

### 확인

```bash
gemini --version
```

---

## 5. Git Hooks 설정 (자동 AI 리뷰)

### Husky 설치

```bash
npm install -D husky
npx husky init
```

### post-commit Hook

프로젝트에 이미 설정되어 있습니다:
- `.husky/post-commit`
- `scripts/hooks/post-commit.js`

**동작 방식**:
1. 커밋 번호로 리뷰어 결정 (홀수: Codex, 짝수: Gemini)
2. 변경된 파일 목록 추출
3. AI 리뷰 실행
4. 결과를 `reports/ai-review/pending/`에 저장

---

## 6. 설치 확인

### 로그인 상태 확인

```bash
# Claude Code - 로그인 필요 시 브라우저 열림
claude

# Codex - 로그인 필요 시 브라우저 열림
codex

# Gemini - 로그인 필요 시 브라우저 열림
gemini
```

### MCP 서버 확인

Claude Code 내에서:
```
You: "MCP 서버 상태 확인해줘"
Claude: [context7, supabase, next-devtools 등 사용 가능 여부 표시]
```

---

## 트러블슈팅

### 로그인 실패

```
증상: 브라우저가 열리지 않음
해결:
1. WSL에서는 Windows 브라우저 연동 확인
2. BROWSER 환경변수 설정: export BROWSER=wslview
3. 수동으로 URL 복사하여 브라우저에서 열기
4. 수동 OAuth 코드 플로우: NO_BROWSER=true gemini -p "auth check"
```

### MCP 서버 시작 안 됨

```
증상: "MCP server not available"
해결:
1. 의존성 설치: npm install / pip install uvx
2. 환경변수 확인: echo $SUPABASE_ACCESS_TOKEN
3. 로그 확인: claude --debug
```

### WSL 브라우저 연동

```bash
# WSL에서 Windows 브라우저 열기 설정
sudo apt install wslu
export BROWSER=wslview

# .bashrc에 추가
echo 'export BROWSER=wslview' >> ~/.bashrc
```

---

## 인증 방식 요약

| 도구 | 인증 방식 | 필요 조건 |
|------|----------|----------|
| Claude Code | OAuth (브라우저 로그인) | Anthropic 계정 |
| Codex | OAuth (브라우저 로그인) | OpenAI Pro/Plus |
| Gemini | OAuth (브라우저 로그인) | Google 계정 |
| MCP 서버 | 토큰/API 키 | 각 서비스 발급 |

---

## 관련 문서

- [Claude Code](./claude-code.md)
- [MCP 서버](./mcp-servers.md)
- [AI 도구들](./ai-tools.md)
- [워크플로우](./workflows.md)
