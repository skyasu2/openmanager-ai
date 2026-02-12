# 프로젝트 설정

> 프로젝트 초기화 및 환경 구성 가이드

## 프로젝트 클론

```bash
# SSH (권장)
git clone git@github.com:skyasu2/openmanager-ai.git

# HTTPS
git clone https://github.com/skyasu2/openmanager-ai.git

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
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
AI_ENGINE_URL=https://ai-engine-xxx.run.app
AI_ENGINE_API_KEY=your-api-key

# ============================================
# Optional
# ============================================
SENTRY_DSN=
NEXT_PUBLIC_GA_ID=
```

### 3. API 키 발급

| 서비스 | 발급 URL | 무료 티어 |
|--------|---------|----------|
| Supabase | [supabase.com](https://supabase.com) | 500MB DB |
| Cerebras | [cloud.cerebras.ai](https://cloud.cerebras.ai) | 무료 |
| Mistral | [console.mistral.ai](https://console.mistral.ai) | 무료 크레딧 |
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

1. [Vibe Coding 가이드](../vibe-coding/README.md) - AI 도구 활용
2. [테스트 전략](../guides/testing/test-strategy.md)
3. [아키텍처](../reference/architecture/system/system-architecture-current.md)
