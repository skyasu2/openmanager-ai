# 전체 환경 구축 가이드 (제로베이스)

> Windows 11에서 처음부터 Vibe Coding 환경 구축하기

## 개요

이 가이드를 따라하면 **완전히 새로운 Windows 11 PC**에서 OpenManager AI 프로젝트를 개발할 수 있습니다.

### 예상 소요 시간
- 전체: 약 1-2시간
- 숙련자: 약 30분

### 필요 조건
- Windows 11 (Home/Pro)
- 인터넷 연결
- 관리자 권한

---

## 체크리스트

```
[ ] 1. Windows 설정
[ ] 2. WSL 2 설치
[ ] 3. Ubuntu 설정
[ ] 4. 개발 도구 설치 (Node.js, Git)
[ ] 5. AI 도구 설치 (Claude Code, Codex, Gemini)
[ ] 6. MCP 서버 설정
[ ] 7. 프로젝트 클론 및 설정
[ ] 8. 검증
```

---

## Phase 1: Windows 설정

### 1.1 Windows 업데이트

```
설정 → Windows 업데이트 → 업데이트 확인
```

최신 상태 유지 필수 (WSL 2 호환성)

### 1.2 개발자 모드 활성화

```
설정 → 개인 정보 및 보안 → 개발자용 → 개발자 모드 ON
```

### 1.3 필수 Windows 기능 활성화

PowerShell (관리자):
```powershell
# WSL 기능 활성화
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Virtual Machine Platform 활성화
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# 재부팅
shutdown /r /t 0
```

---

## Phase 2: WSL 2 설치

### 2.1 WSL 설치

PowerShell (관리자):
```powershell
wsl --install
```

재부팅 후 계속:
```powershell
# WSL 2를 기본값으로
wsl --set-default-version 2

# 버전 확인
wsl --version
```

### 2.2 Ubuntu 설치

```powershell
# Ubuntu 24.04 설치 (권장 - 2026년 기준)
wsl --install -d Ubuntu-24.04

# 또는 Microsoft Store에서 "Ubuntu 24.04" 검색 후 설치

# 기존 Ubuntu 22.04도 호환됨
# wsl --install -d Ubuntu-22.04
```

### 2.3 Ubuntu 초기 설정

Ubuntu 최초 실행 시:
```bash
# 사용자 이름 입력 (예: developer)
# 비밀번호 설정

# 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y build-essential curl wget git unzip
```

### 2.4 WSL 메모리 최적화

Windows에서 `.wslconfig` 생성:
```powershell
# PowerShell에서 실행
notepad "$env:USERPROFILE\.wslconfig"
```

내용 입력:
```ini
[wsl2]
memory=16GB
processors=4
swap=0
networkingMode=mirrored
localhostForwarding=true

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
dnsTunneling=false
autoProxy=false
```

실측 기준(2026-02-13): `nproc=4`, `free -h`에서 `Swap: 0B`

WSL 재시작:
```powershell
wsl --shutdown
wsl
```

---

## Phase 3: 개발 도구 설치

### 3.1 Git 설정

Ubuntu에서:
```bash
# Git 버전 확인
git --version

# 사용자 설정
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
git config --global core.autocrlf input
git config --global init.defaultBranch main
```

### 3.2 SSH 키 생성 (GitHub용)

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your@email.com"
# Enter 3번 (기본값 사용)

# 공개키 복사
cat ~/.ssh/id_ed25519.pub
```

GitHub 설정:
1. https://github.com/settings/keys
2. "New SSH key" 클릭
3. 복사한 키 붙여넣기
4. 저장

### 3.3 Node.js 설치 (nvm)

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 셸 재시작
source ~/.bashrc

# nvm 확인
nvm --version

# Node.js 24 설치 (프로젝트 버전, .nvmrc 참조)
nvm install 24
nvm use 24
nvm alias default 24

# 확인
node -v   # v24.x
npm -v    # 10.9.2+
```

### 3.4 Python 설치 (MCP용)

```bash
# Python 확인
python3 --version  # 3.10+ 필요

# pip 업그레이드
pip3 install --upgrade pip

# uvx 설치 (Serena MCP용)
pip3 install uvx
```

---

## Phase 4: AI 도구 설치

### 4.1 Claude Code 설치 (Native Installer 권장)

> **Note**: NPM 설치 방식은 **Deprecated** 되었습니다. Native Installer를 사용하세요.

```bash
# Native Installer (권장)
curl -fsSL https://claude.ai/install.sh | sh

# 설치 확인
claude --version
claude doctor      # 설치 유형 및 상태 점검
```

**Native Installer 특징**:
- Node.js 불필요 (독립 실행형 바이너리)
- **자동 백그라운드 업데이트** (수동 업그레이드 불필요)
- WSL2 샌드박싱 지원

```bash
# ⚠️ NPM 설치 (Deprecated) - 기존 사용자만
# npm install -g @anthropic-ai/claude-code

# NPM → Native 마이그레이션
# claude install
```

### 4.2 Claude Code 로그인

```bash
# WSL 브라우저 연동 설정
sudo apt install -y wslu
echo 'export BROWSER=wslview' >> ~/.bashrc
source ~/.bashrc

# Claude Code 실행 (브라우저 로그인)
claude
```

브라우저가 열리면:
1. Anthropic 계정으로 로그인
2. 권한 승인
3. 터미널로 돌아옴

### 4.3 Codex 설치 및 로그인

```bash
# 설치
npm install -g @openai/codex

# 로그인 (브라우저)
codex
```

**Note**: OpenAI Pro/Plus 구독 필요

### 4.4 Gemini 설치 및 로그인

```bash
# 설치
npm install -g @google/gemini-cli

# 로그인 (브라우저)
gemini
```

---

## Phase 5: MCP 서버 설정

### 5.1 환경변수 준비

각 서비스에서 토큰 발급:

| 서비스 | 발급 URL |
|--------|---------|
| Supabase | https://supabase.com/dashboard/account/tokens |
| Vercel | https://vercel.com/account/tokens |
| GitHub | https://github.com/settings/tokens |
| Tavily | https://tavily.com |

### 5.2 환경변수 설정

```bash
# .bashrc에 추가
cat >> ~/.bashrc << 'EOF'

# MCP Server Tokens
export SUPABASE_ACCESS_TOKEN="sbp_your_token"
export VERCEL_TOKEN="your_token"
export GITHUB_TOKEN="ghp_your_token"
export TAVILY_API_KEY="tvly-your_key"
EOF

source ~/.bashrc
```

### 5.3 Claude Code MCP 설정

```bash
# 설정 디렉토리 생성
mkdir -p ~/.claude

# settings.json 생성
cat > ~/.claude/settings.json << 'EOF'
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["serena-mcp"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic/sequential-thinking-mcp"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    },
    "vercel": {
      "command": "npx",
      "args": ["-y", "@vercel/mcp"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/playwright-mcp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/github-mcp"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "tavily": {
      "command": "npx",
      "args": ["-y", "@tavily/mcp-server"],
      "env": {
        "TAVILY_API_KEY": "${TAVILY_API_KEY}"
      }
    }
  }
}
EOF
```

### 5.4 Hooks 설정 (자동 포맷팅)

프로젝트에 포함된 `.claude/settings.json`이 자동으로 적용됩니다:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "command": "biome format --write <file>",
          "timeout": 10
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "command": "echo <command> >> logs/claude-bash-commands.log"
        }]
      }
    ]
  }
}
```

**효과**:
- 파일 수정 시 자동으로 Biome 포맷팅
- Bash 명령어 실행 로그 기록

### 5.5 권한 설정 (최초 1회)

Claude Code 최초 실행 시 권한 질문이 나타납니다. 허용할 패턴:

```bash
# 권장 허용 패턴 (자동 승인됨)
Bash(npm:*)          # npm 명령어
Bash(git:*)          # git 명령어
Bash(gh:*)           # GitHub CLI
mcp__serena__*       # Serena MCP 전체
mcp__supabase__*     # Supabase MCP 전체
Skill(commit)        # 커밋 스킬
```

권한 설정은 `.claude/settings.local.json`에 저장됩니다 (Git 제외).

---

## Phase 6: 프로젝트 설정

### 6.1 작업 디렉토리 생성

```bash
# 프로젝트 디렉토리 (WSL 파일시스템 권장)
mkdir -p ~/projects
cd ~/projects
```

### 6.2 프로젝트 클론

```bash
# SSH로 클론
git clone git@github.com:skyasu2/openmanager-ai.git

# 또는 HTTPS
git clone https://github.com/skyasu2/openmanager-ai.git

cd openmanager-ai
```

### 6.3 Node.js 버전 확인

```bash
# .nvmrc 자동 적용
nvm use

# 버전 확인
node -v  # v24.x
```

### 6.4 의존성 설치

```bash
npm install
```

### 6.5 환경변수 설정

```bash
# 템플릿 복사
cp .env.example .env.local

# 편집
nano .env.local
```

필수 설정:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Providers (무료 티어 가능)
CEREBRAS_API_KEY=csk-...
MISTRAL_API_KEY=...
GROQ_API_KEY=gsk_...
```

---

## Phase 7: 검증

### 7.1 개발 서버 실행

```bash
npm run dev:network
```

브라우저에서 http://localhost:3000 접속

### 7.2 빌드 검증

```bash
npm run build
```

### 7.3 테스트 실행

```bash
npm run test:quick
```

### 7.4 Claude Code 검증

```bash
# 프로젝트 디렉토리에서
claude

# 테스트 질문
You: "프로젝트 구조 설명해줘"
```

MCP 서버 동작 확인:
```
You: "serena로 useServerStatus 훅 찾아줘"
```

### 7.5 AI 리뷰 검증

```bash
# 테스트 커밋
echo "// test" >> test.tmp
git add test.tmp
git commit -m "test: verify ai review"

# 리뷰 생성 확인
ls reports/ai-review/pending/

# 정리
git reset --hard HEAD~1
```

---

## 완료 체크리스트

```
[✓] Windows 11 WSL 2 설정
[✓] Ubuntu 24.04 (또는 22.04) 설치 및 설정
[✓] Node.js 24.x (nvm)
[✓] Git + SSH 키 설정
[✓] Claude Code 설치 + 로그인
[✓] Codex 설치 + 로그인
[✓] Gemini 설치 + 로그인
[✓] MCP 서버 9개 설정
[✓] 프로젝트 클론 + 의존성
[✓] 환경변수 설정
[✓] 개발 서버 동작 확인
[✓] AI 리뷰 동작 확인
[✓] Git Hooks 동작 확인 (pre-commit, pre-push)
```

---

## 트러블슈팅

### WSL 설치 실패

```
증상: "WslRegisterDistribution failed"
해결:
1. Windows 업데이트 확인
2. Hyper-V 비활성화된 경우 활성화
3. BIOS에서 가상화 활성화
```

### 브라우저가 열리지 않음

```
증상: Claude/Codex 로그인 시 브라우저 안 열림
해결:
1. wslu 설치: sudo apt install wslu
2. export BROWSER=wslview
3. 수동으로 URL 복사 후 Windows 브라우저에서 열기
```

### npm install 실패

```
증상: EACCES permission denied
해결:
1. sudo 사용하지 않기
2. nvm으로 설치한 Node.js 사용 확인
3. npm cache clean --force
```

### MCP 서버 연결 안 됨

```
증상: "MCP server not available"
해결:
1. 환경변수 확인: echo $GITHUB_TOKEN
2. settings.json 경로 확인: ~/.claude/settings.json
3. claude --debug로 로그 확인
```

---

## 다음 단계

환경 구축이 완료되었습니다:

1. [Vibe Coding 가이드](../vibe-coding/README.md) - AI 도구 활용법
2. [워크플로우](../vibe-coding/workflows.md) - 일일 개발 사이클
3. [코딩 표준](./coding-standards.md) - 프로젝트 규칙
4. [Git Hooks 워크플로우](./git-hooks-workflow.md) - Pre-commit/Pre-push 설정

---

## 버전 정보

| 도구 | 버전 |
|------|------|
| Windows | 11 |
| WSL | 2 |
| Ubuntu | 24.04 (또는 22.04) |
| Node.js | 24.x |
| npm | 11.6.2+ |
| Python | 3.10+ |
| Next.js | 16.1.3 |
| React | 19 |
| TypeScript | 5.9.3 |

_Last Updated: 2026-01-27_
