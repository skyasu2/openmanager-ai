# AI 도구 설치 가이드

> Claude Code 메인 + Codex/Gemini 교차 사용 설치 가이드
> Owner: dev-experience
> Status: Active Supporting
> Doc type: Tutorial
> Last reviewed: 2026-04-25
> Canonical: docs/development/vibe-coding/setup.md
> Tags: vibe-coding,setup,mcp

## 개요

Vibe Coding에 필요한 AI CLI 도구들의 설치 방법입니다.

범위:
- 이 문서: AI CLI 설치/로그인/최소 검증
- MCP 상세 설정/권한/서버 카탈로그: [mcp-servers.md](./mcp-servers.md)
- WSL/배포환경 부트스트랩: [../project-setup.md](../project-setup.md)

```
┌─────────────────────────────────────────────────────────┐
│                    설치 순서                             │
├─────────────────────────────────────────────────────────┤
│  1. CLI 3종 설치  →  2. MCP 서버  →  3. 협업 검증 절차    │
│  Claude/Codex/Gemini   (확장 기능)    (코드/로직 검증)    │
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

1. **`.mcp.json` 확인**: repo에 추적되는 project MCP 설정을 확인하고, 실제 토큰은 `.env.local` 또는 shell env에 둡니다.

2. **권한 설정**: `.claude/settings.local.json` 생성

### 구성 기준

- Codex SSOT: `.codex/config.toml`의 `[mcp_servers.*]`
- Codex bootstrap: `npm run mcp:setup:codex`로 tracked template 기반 project config를 재생성 가능
- Codex runtime: 직접 `codex`보다 `bash scripts/mcp/codex-local.sh ...` 경로를 우선 사용
- Codex auth/env: GitHub/Supabase 토큰은 `.codex/config.toml`에 직접 넣지 않고 런타임에 shell env 또는 `.env.local`에서 주입
- Codex config 선택: `scripts/mcp/resolve-runtime-env.sh`가 기본적으로 project `/.codex`를 home `~/.codex`보다 우선
- Codex scope: OpenManager MCP는 project `.codex/config.toml`, 공통 skill은 `.agents/skills`만 사용합니다. `~/.codex/skills`와 `.codex/skills`에 OpenManager 공통 skill 복사본을 두지 않습니다.
- Gemini runtime: MCP discovery가 필요하면 `GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini ...` 또는 `bash scripts/mcp/run-with-project-env.sh gemini ...` 경로를 사용. 핵심은 workspace trust와 no-relaunch를 명시하는 것입니다.
- Gemini scope: 공식 `gemini mcp add` 기본 scope는 `project`입니다. OpenManager 전용 MCP는 tracked `.gemini/settings.json`에서 관리하고, user settings는 개인 preference 영역으로 유지합니다.
- Claude 로컬: `.mcp.json` + `.claude/settings.local.json`
- 수치(서버 개수) 대신 SSOT 기준으로 확인: `bash scripts/mcp/codex-local.sh mcp list`

---

## 3. Codex CLI 설치 (보완/QA)

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
# project .codex/config.toml bootstrap
npm run mcp:setup:codex

codex --version

# 프로젝트 기준 MCP 확인
bash scripts/mcp/codex-local.sh mcp list
bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe
npm run codex:check
GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini mcp list --debug
npm run skills:check
```

---

## 4. Gemini CLI 설치 (검증/대안)

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

### 브리지/보조 실행 (WSL)

```bash
# 예시: OpenManager 브리지 호출
bash scripts/ai/agent-bridge.sh --to gemini "다른 설명 없이 HELLO_FROM_GEMINI 만 출력"
```

현재 OpenManager 로컬 운영 기준은 **API 키 대신 브라우저 로그인(OAuth) 세션 사용**입니다.
WSL에서 `gemini -p`가 불안정하면 API 키로 우회하지 말고, 로그인 상태를 확인한 뒤 대화형 실행 또는 수동 검증으로 전환합니다.

### 확인

```bash
gemini --version
```

---

## 5. 협업 스크립트 사용 (권장)

자동 AI 리뷰 대신, 에이전트 간 대화/리뷰 요청은 브리지 스크립트로 수행합니다.

```bash
# Codex에게 리뷰 요청
bash scripts/ai/agent-bridge.sh --to codex "현재 변경분 리뷰해줘"

# Gemini에게 로직 검증 요청
bash scripts/ai/agent-bridge.sh --to gemini "이 로직의 리스크를 분석해줘"

# Claude에게 문서화 요청
bash scripts/ai/agent-bridge.sh --to claude --mode doc "변경사항 릴리즈노트 작성"
```

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
Claude: [supabase-db, vercel, playwright, next-devtools 등 사용 가능 여부 표시]
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
2. shell env 또는 `.env.local`에 필요한 토큰이 있는지 확인
3. Codex는 `bash scripts/mcp/codex-local.sh mcp list`로 project config 기준 상태 확인
4. 로그 확인: claude --debug
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

## 7. WSL2 GitLab Runner 복구/이전 가이드 (1인 개발용)

개발 컴퓨터 포맷, 교체, 또는 WSL2 재설치 등으로 로컬 `wsl2-docker` Runner가 미가동 상태일 때 빠르게 복구하는 절차입니다.

### 1단계: Runner 상태 확인
로컬 Runner 상태를 진단하여 복구가 필요한지 검사합니다.
```bash
bash scripts/ci/runner-health-check.sh
```

### 2단계: GitLab Runner 패키지 설치
WSL2(Ubuntu 기준)에 패키지를 다시 등록합니다.
```bash
# GitLab 공식 레포지토리 추가 및 설치
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner
```

### 3단계: Runner 신규 등록 (Register)
GitLab 프로젝트 설정(`Settings > CI/CD > Runners`)에서 획득한 Registration Token을 이용하여 Runner를 로컬에 등록합니다.
```bash
sudo gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.com/" \
  --registration-token "YOUR_PROJECT_REGISTRATION_TOKEN" \
  --executor "shell" \
  --description "wsl2-local-developer" \
  --tag-list "wsl2-docker" \
  --run-untagged="true" \
  --locked="false"
```

- **Executor**: `shell`로 설정하여 WSL2 내 설치된 Node, npm, vercel, gcloud 등을 가상화 오버헤드 없이 직접 호출합니다.
- **Tag**: 반드시 `wsl2-docker`를 기재해야 파이프라인이 Job을 할당합니다.

### 4단계: Docker 연동 및 권한 설정
WSL2 내 Docker가 정상 기동되고 있는지 확인하고, `gitlab-runner` 사용자가 docker 그룹에 포함되어 있는지 확인합니다.
```bash
# Docker 서비스 상태 확인 및 기동
sudo service docker status || sudo service docker start

# gitlab-runner 사용자를 docker 그룹에 추가 (권한 에러 방지)
sudo usermod -aG docker gitlab-runner
sudo systemctl restart gitlab-runner
```

### 5단계: 로컬 동등성 검증
파이프라인을 원격에 올리기 전에 로컬 환경에서 CI 정합성 검사를 수동으로 구동해 봅니다.
```bash
npm run ci:local
```

---

## 관련 문서

- [Claude Code](./claude-code.md)
- [MCP 서버](./mcp-servers.md)
- [AI 도구들](./multi-agent-tools.md)
- [워크플로우](./workflows.md)
