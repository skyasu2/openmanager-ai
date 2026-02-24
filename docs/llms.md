# OpenManager AI v8 - LLM Context

> AI 어시스턴트 컨텍스트 전달용 핵심 프로젝트 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-24
> Canonical: docs/llms.md
> Tags: llm,context,ai
>
> **v8.3.3** | Updated 2026-02-24
>
> AI 어시스턴트가 프로젝트를 이해하는 데 필요한 핵심 정보

## Project Overview

OpenManager AI is an AI-native server monitoring platform built with:
- Frontend: Next.js 16, React 19, TypeScript 5.9
- AI Engine: Vercel AI SDK 6, Multi-Agent System
- Database: Supabase (PostgreSQL + pgVector)
- Deployment: Vercel (Frontend) + Cloud Run (AI Engine)

## Architecture

### Hybrid Architecture
```
[User] → [Vercel/Next.js] → [Cloud Run/AI Engine] → [Supabase]
              ↓                      ↓
         UI/API Proxy         Multi-Agent System
```

### AI Engine Components
- Supervisor: Dual-mode (Single/Multi Agent)
- Agents (실행): NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer
- Orchestrator: 에이전트 라우팅 코디네이터 (별도 컴포넌트)
- Providers: Cerebras(gpt-oss-120b) → Groq(llama-3.3-70b) → Mistral(mistral-large) (3-way fallback chain) + Gemini (Vision)
- Tools: 26 specialized tools (Metrics 5, RCA 3, Analyst 4, Knowledge 3, Evaluation 6, Control 1, Vision 4)

## Key Files

### Entry Points
- `src/app/page.tsx` - Main dashboard
- `cloud-run/ai-engine/src/server.ts` - AI Engine entry
- `CLAUDE.md` - AI assistant instructions

### Configuration
- `.env.local` - Environment variables
- `package.json` - Dependencies
- `next.config.mjs` - Next.js config

### Documentation
- `docs/README.md` - Documentation index
- `docs/QUICK-START.md` - Getting started
- `docs/DEVELOPMENT.md` - Development guide
- `docs/reference/architecture/ai/ai-engine-architecture.md` - AI architecture

## Common Tasks

### Development
```bash
npm run dev:network    # Start dev server
npm run validate:all   # Run all validations
npm run test           # Run tests
```

### Deployment
```bash
npm run release:patch  # Version bump
git push --follow-tags # Deploy to Vercel
```

### AI Engine
```bash
SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')
curl $SERVICE_URL/health  # Health check
```

## Important Constraints

1. TypeScript strict mode - no `any` types
2. AI Engine timeout: 300s (Cloud Run free-tier deploy config)
3. Vercel timeout:
   - Fluid Compute: Hobby 300s(default)/300s max, Pro 300s(default)/800s max
4. Free tier optimization: Cerebras(3000 tok/s)/Groq/Mistral rotation

Reference (checked: 2026-02-24):
- https://vercel.com/docs/limits/overview

## Contact

- Repository: github.com/skyasu2/openmanager-ai
- Version: 8.3.3
