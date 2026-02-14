# OpenManager AI v8 - LLM Context

> AI 어시스턴트 컨텍스트 전달용 핵심 프로젝트 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/llms.md
> Tags: llm,context,ai
>
> **v8.0.0** | Updated 2026-02-12
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
- Agents: NLQ, Analyst, Reporter, Advisor, Vision
- Providers: Cerebras → Groq → Mistral (fallback chain) + Gemini (Vision)
- Tools: 26 specialized tools (Metrics 5, RCA 3, Analyst 4, Reporter 4, Evaluation 6, Control 1, Vision 4)

## Key Files

### Entry Points
- `src/app/page.tsx` - Main dashboard
- `cloud-run/ai-engine/src/server.ts` - AI Engine entry
- `CLAUDE.md` - AI assistant instructions

### Configuration
- `.env.local` - Environment variables
- `package.json` - Dependencies
- `next.config.ts` - Next.js config

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
curl https://ai-engine-490817238363.asia-northeast1.run.app/health  # Health check
```

## Important Constraints

1. TypeScript strict mode - no `any` types
2. AI Engine timeout: unlimited (Cloud Run)
3. Vercel timeout: 60s (Pro tier, route-specific maxDuration)
4. Free tier optimization: Cerebras/Mistral/Groq rotation + Gemini (Vision)

## Contact

- Repository: github.com/skyasu2/openmanager-ai
- Version: 8.0.0
