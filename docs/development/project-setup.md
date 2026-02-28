# 프로젝트 설정

> 프로젝트 초기화 및 환경 구성 가이드
> Owner: dev-experience
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-02-22
> Canonical: docs/development/project-setup.md
> Tags: wsl,github-auth,project-setup

## 제로베이스 환경(Windows + WSL) 시작점

새 머신에서 시작하는 경우 아래 순서로 최소 부트스트랩을 완료한 뒤 본 문서를 이어서 진행합니다.

1. Windows 11 업데이트 + WSL 2 설치
2. Ubuntu 초기 설정 (`apt update && apt upgrade`)
3. Git/Node.js 24/nvm 설치
4. `gh auth login` + `gh auth setup-git`

제로베이스 부트스트랩 기준은 본 문서를 Canonical로 유지합니다.

## GitHub 인증 방식 비교 (WSL)

| 방식 | 장점 | 단점 | 권장도 |
|------|------|------|------|
| HTTPS + `gh auth login` | WSL/Windows 혼합 환경에서 안정적, credential helper 연동 쉬움 | 최초 브라우저 인증 필요 | 권장 |
| SSH 키 | 키 기반 인증, 토큰 불필요 | 초기 설정/키 관리 부담 | 선택 |
| Classic PAT + `gh auth login` | 즉시 사용, push 권한 확실 | 토큰 만료 관리 부담 | WSL 대안 |

권장 절차:
```bash
# 방법 1: 브라우저 로그인 (WSL Interop 필요)
gh auth login -h github.com -p https -w
gh auth status -h github.com
gh auth setup-git

# 방법 2: Classic PAT (WSL에서 브라우저 안 열릴 때)
# GitHub → Settings → Tokens → Classic → repo, read:org, workflow 스코프
gh auth login -h github.com -p https  # "Paste an authentication token" 선택
gh auth setup-git
```

> **WSL 주의**: `-w`(브라우저) 방식은 `/etc/wsl.conf`에 `[interop] enabled=true`가 필요합니다.
> 브라우저가 안 열리면 Classic PAT 방식을 사용하세요.
> **Fine-grained PAT**은 `git push`가 403으로 실패할 수 있으므로 **Classic PAT** 권장.

비교 기준(공식 문서):
- GitHub CLI 인증/credential helper: https://cli.github.com/manual/gh_auth_login, https://cli.github.com/manual/gh_auth_setup-git
- 토큰 최소 권한 원칙(Fine-grained PAT): https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## 프로젝트 클론

```bash
# 권장: HTTPS + gh auth
git clone https://github.com/skyasu2/openmanager-ai.git

# 선택: SSH
# git clone git@github.com:skyasu2/openmanager-ai.git

cd openmanager-ai
```

## 의존성 설치

```bash
# Node.js 버전 확인
nvm use  # .nvmrc 자동 적용

# 패키지 설치
npm install
```

## 환경변수 설정

### 1. 템플릿 복사

```bash
cp .env.example .env.local
```

### 2. 필수 변수 설정

```bash
# .env.local

# ============================================
# Supabase (필수)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # 레거시 fallback
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ============================================
# AI Providers (최소 1개 필수)
# ============================================
CEREBRAS_API_KEY=csk-...
MISTRAL_API_KEY=...
GROQ_API_KEY=gsk_...

# ============================================
# Cloud Run AI Engine
# ============================================
CLOUD_RUN_AI_URL=https://ai-engine-xxx.run.app
CLOUD_RUN_API_SECRET=your-api-secret

# ============================================
# Optional
# ============================================
SENTRY_DSN=
NEXT_PUBLIC_GA_ID=
GUEST_LOGIN_BLOCKED_COUNTRIES=CN
NEXT_PUBLIC_GUEST_FULL_ACCESS=false
NEXT_PUBLIC_GUEST_MODE=restricted
GUEST_LOGIN_PIN=1234
```

### 3. API 키 발급

| 서비스 | 발급 URL | 무료 티어 |
|--------|---------|----------|
| Supabase | [supabase.com](https://supabase.com) | 500MB DB |
| Cerebras | [cloud.cerebras.ai](https://cloud.cerebras.ai) | 무료 |
| Mistral | https://mistral.ai | 무료 크레딧 |
| Groq | [console.groq.com](https://console.groq.com) | 무료 |

## 데이터베이스 설정

### Supabase 로컬 (선택)

```bash
# Supabase CLI 설치
npm install -g supabase

# 로컬 시작
npx supabase start

# 마이그레이션 적용
npx supabase db push
```

### 스키마 확인

```bash
# 테이블 목록
npx supabase db dump --schema public
```

## 개발 서버 실행

```bash
# 네트워크 모드 (Windows 브라우저 접속용)
npm run dev:network

# 기본 모드 (WSL 내부만)
npm run dev
```

## 검증

### 빠른 검증

```bash
npm run validate:all
```

### 개별 검증

```bash
npm run lint        # 린트
npm run type-check  # 타입
npm run test:quick  # 테스트
npm run build       # 빌드
```

## AI 브릿지 설정 (WSL)

`scripts/ai/agent-bridge.sh`로 Claude/Codex/Gemini를 동일 인터페이스로 호출합니다.

권장 환경변수:
```bash
# Gemini 비대화형 호출 안정성 향상
export GEMINI_API_KEY=your_key
```

기본 점검:
```bash
# Claude (기본 fast 모드: /tmp 실행)
bash scripts/ai/agent-bridge.sh --to claude --mode query "안녕하세요만 출력"

# Codex
bash scripts/ai/agent-bridge.sh --to codex --mode analysis "현재 브릿지 상태 요약"

# Gemini
bash scripts/ai/agent-bridge.sh --to gemini --mode query "안녕하세요만 출력"
```

주요 옵션:
```bash
# Claude 전체 컨텍스트 실행
bash scripts/ai/agent-bridge.sh --to claude --claude-full "요약해줘"

# 자기 자신 호출 차단(오케스트레이션 권장)
bash scripts/ai/agent-bridge.sh --to claude --from codex --no-self "질문"

# 결과 문서 자동 저장 + 민감정보 마스킹
bash scripts/ai/agent-bridge.sh --to codex --mode doc --save-auto --redact "회의 내용 정리"
```

로그 위치:
- 호출 로그: `logs/ai-bridge/bridge.log`
- 문서화 결과: `logs/ai-bridge/notes/`

## 폴더 구조

```
openmanager-ai/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React 컴포넌트
│   ├── hooks/            # Custom Hooks
│   ├── services/         # 비즈니스 로직
│   ├── stores/           # Zustand 상태
│   ├── types/            # TypeScript 타입
│   └── lib/              # 유틸리티
├── cloud-run/
│   └── ai-engine/        # Cloud Run AI 엔진
├── public/
│   └── hourly-data/      # 시뮬레이션 데이터
├── config/               # 설정 파일들
├── docs/                 # 문서
└── tests/                # 테스트
```

## Git 브랜치 전략

```
main          # 프로덕션 (자동 배포)
├── feature/* # 기능 개발
├── fix/*     # 버그 수정
└── docs/*    # 문서 작업
```

### 브랜치 생성

```bash
git checkout -b feature/my-feature
git checkout -b fix/bug-description
```

## 트러블슈팅

### npm install 실패

```bash
# 캐시 정리
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 타입 에러

```bash
# TypeScript 재시작 (VS Code)
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### 환경변수 미적용

```bash
# .env.local 확인
cat .env.local

# 서버 재시작
npm run dev:network
```

## 다음 단계

1. [Vibe Coding 허브](./vibe-coding/README.md) - AI 도구 활용
2. [테스트 전략](../guides/testing/test-strategy.md)
3. [아키텍처](../reference/architecture/system/system-architecture-current.md)
