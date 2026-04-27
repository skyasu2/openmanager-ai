# OpenManager AI v8 - LLM Context

> AI 어시스턴트 컨텍스트 전달용 핵심 프로젝트 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-04-04
> Canonical: docs/llms.md
> Tags: llm,context,ai
>
> **v8.10.8** | Updated 2026-04-04
>
> AI 어시스턴트가 프로젝트를 이해하는 데 필요한 핵심 정보

## Project Overview

OpenManager AI is an AI-native server monitoring platform built with:
- Frontend: Next.js 16, React 19, TypeScript 5.9
- AI Engine: Vercel AI SDK 6 family, multi-agent first system
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
- Supervisor: multi-agent first mode resolver (`single` gated, `auto` complexity-based)
- Agents (실행): NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer
- Orchestrator: 에이전트 라우팅 코디네이터 (별도 컴포넌트)
- Providers:
  - Group A tool-calling path (Supervisor/NLQ/Advisor): Groq → Cerebras → Mistral
  - Group B tool-calling path (Analyst/Reporter/Verifier): Cerebras → Groq → Mistral
  - Structured routing path: Cerebras → Groq → Mistral
  - Vision: Gemini Flash-Lite → OpenRouter
- Tools: 30 specialized tools (Metrics 6, RCA 3, Analyst 4, Knowledge 3, Evaluation 6, Control 1, Vision 4, Math 3)
- Observability: Langfuse mode audit (`requestedMode`, `resolvedMode`, `modeSelectionSource`) + `handoffCount`

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
git push gitlab main   # Canonical validate path via GitLab CI
git push --follow-tags gitlab main  # Canonical production deploy path
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
4. Free tier optimization:
   - low-complexity `auto` 요청은 single 유지 가능
   - explicit `single`은 `ALLOW_DEGRADED_SINGLE=true`일 때만 허용
   - Cerebras tool-calling은 기본 `false`, 필요할 때만 `CEREBRAS_TOOL_CALLING_ENABLED=true`로 opt-in

## Current Notes

- Vision 기본 모델은 `gemini-2.5-flash-lite`
- Orchestrator는 `generateObjectWithFallback`로 structured routing 수행
- Agent 실행은 `streamText` / `generateTextWithRetry` 기반 tool loop
- Cerebras는 structured-output primary, tool loop는 기본 비활성 + capability gate로 선제 skip

Reference (checked: 2026-04-04):
- https://vercel.com/docs/limits/overview

## Contact

- Canonical repository: GitLab private remote (`gitlab`)
- Public snapshot: github.com/skyasu2/openmanager-ai
- Version: 8.10.8
