# OpenManager AI 빠른 시작 가이드

> 5분 내 로컬 개발 환경 구성과 실행을 위한 빠른 시작 문서
> Owner: dev-experience
> Status: Active
> Doc type: Tutorial
> Last reviewed: 2026-03-25
> Canonical: docs/QUICK-START.md
> Tags: quickstart,onboarding,setup
>
> **v8.0.0** | Updated 2026-03-25

**AI 기반 실시간 서버 모니터링 플랫폼** - 5분 만에 시작하기

## 📋 필수 준비사항

- **Node.js** v24.x 이상
- **npm** v10.9.2 이상
- **Git**
- **Windows 11 + WSL 2** (권장 개발 환경)
- **Claude Code** (메인 AI 개발 도구)

## ⚡ 빠른 설정

### 1. 프로젝트 복제 및 설치

```bash
git clone https://github.com/your-username/openmanager-ai.git
cd openmanager-ai
npm install
```

### 2. 환경 변수 설정

```bash
# .env.local 생성
cp .env.example .env.local
```

**`.env.local` 필수 설정**:

```bash
# Supabase 연결 (필수)
SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key # 레거시 fallback
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # 로그인 감사 로그 저장용(서버 전용)

# AI 기능 (Cloud Run AI - GCP IAM 인증 사용)
CLOUD_RUN_ENABLED=true
CLOUD_RUN_AI_URL=https://ai-engine-xxx.asia-northeast1.run.app
CLOUD_RUN_API_SECRET=your_cloud_run_api_secret

# Optional: 게스트 로그인 국가 차단 (기본값: CN)
GUEST_LOGIN_BLOCKED_COUNTRIES=CN

# Optional: Vercel 원격 테스트용 게스트 PIN 인증
NEXT_PUBLIC_GUEST_FULL_ACCESS=false
GUEST_LOGIN_PIN=1234
```

### 3. 개발 서버 실행

```bash
# 안정화된 개발 서버 (권장)
npm run dev:stable

# 또는 기본 개발 서버
npm run dev
```

서버가 실행되면 `http://localhost:3000` 에서 확인하세요.

## 🎯 주요 기능 체험

### 1. 실시간 서버 모니터링

- 대시보드에서 15개 시뮬레이션 서버 상태 실시간 확인
- CPU, Memory, Disk 사용률 모니터링

### 2. AI 어시스턴트

- **Cloud Run AI**: LLM 멀티 에이전트 기반 실시간 서버 분석 및 자연어 질의
- **Mock 모드**: Cloud Run 연결 불가 시 자동 폴백 (시뮬레이션)

### 3. 게스트 모드 접근

- 모든 기능이 게스트 모드로 제공됨
- PIN 인증 없이 즉시 사용 가능

## 🧪 테스트 실행

```bash
# 빠른 로컬 테스트
npm run test:super-fast

# 계약 테스트
npm run test:contract

# 선택 검증(환경 의존)
npm run test:external-connectivity
npm run test:cloud-contract
npm run vitals:integration

# 로컬 핵심 E2E (게스트/대시보드/접근성)
npm run test:e2e:critical

# 전체 검증
npm run validate:all
```

## 📊 무료 티어 최적화

이 프로젝트는 **100% 무료**로 운영 가능하도록 설계되었습니다:

- **Vercel**: 무료 호스팅 (30GB/월 대역폭)
- **Supabase**: 무료 PostgreSQL + 실시간 기능
- **모니터링**: Mock 시뮬레이션으로 실제 서버 비용 제로

## 🔧 문제 해결

### 개발 서버 오류

```bash
# segment-explorer 에러 시
npm run dev:stable

# 포트 충돌 시
killall -9 node
npm run dev
```

### 빌드 오류

```bash
# TypeScript 검사
npx tsc --noEmit

# 린트 검사
npm run lint

# 모든 검사 실행
npm run validate:all
```

## 📚 더 자세한 정보

- **[개발 환경 상세 가이드](./development/README.md)** - AI 도구, MCP 서버, WSL 설정
- **[AI 협업 워크플로우](./development/vibe-coding/workflows.md)** - Claude Code + Codex + Gemini 2-AI 교차검증
- **[전체 프로젝트 문서](./README.md)** - 아키텍처, API, 설계 문서
- **[시스템 아키텍처](./reference/architecture/system/)** - 기술 스택 및 구조

---

💡 **5분 만에 시작**: 설치 → `.env.local` 설정 → `npm run dev:stable` → `http://localhost:3000`

🎯 **즉시 체험**: 게스트로 체험하기 버튼 클릭 → 실시간 대시보드 확인

🤖 **AI 활용**: Cloud Run AI로 서버 분석 또는 Mock 모드로 체험

🔧 **AI 개발**: WSL + Claude Code + 2-AI 교차검증 (Codex ↔ Gemini)
