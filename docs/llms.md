# OpenManager AI v8 - LLM Context

> AI 어시스턴트 컨텍스트 전달용 핵심 프로젝트 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/llms.md
> Tags: llm,context,ai
>
> **v8.11.97** | Updated 2026-05-05
>
> AI 어시스턴트가 프로젝트를 이해하는 데 필요한 핵심 정보

## Project Overview

OpenManager AI is a human-in-the-loop server monitoring AI assistant built with:
- Frontend: Next.js 16, React 19, TypeScript 5.9
- AI Engine: Vercel AI SDK 6 family, deterministic/single-first advisory runtime with conditional multi-agent escalation
- Database: Supabase (PostgreSQL + Auth/RLS); Knowledge Retrieval Lite uses BM25 RPC + metadata boost
- Deployment: Vercel (Frontend) + Cloud Run (AI Engine)

## Architecture

### Hybrid Architecture
```
[User] → [Vercel/Next.js] → [Cloud Run/AI Engine] → [Supabase]
              ↓                      ↓
         UI/API Proxy         AI Runtime
```

### AI Engine Components
- Supervisor: mode resolver for deterministic/single/multi execution (`single` gated, `auto` complexity-based, multi-agent reserved for escalation)
- Agents (실행): NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer
- Orchestrator: 에이전트 라우팅 코디네이터 (별도 컴포넌트)
- Providers:
  - Group A tool-calling path (Supervisor/NLQ/Orchestrator): Groq → Cerebras → Mistral
  - Group B tool-calling path (Analyst/Reporter/Advisor/Verifier): Cerebras → Groq → Mistral
  - Structured routing path: Groq → Cerebras → Mistral
  - Vision: Gemini Flash-Lite → OpenRouter
- Tools: 30 specialized tools (Metrics 6, RCA 3, Analyst 4, Knowledge 3, Evaluation 6, Control 1, Vision 4, Math 3)
- Observability: Langfuse mode audit (`requestedMode`, `resolvedMode`, `modeSelectionSource`) + `handoffCount`

### Positioning Vocabulary
- Generic Korean: `운영 의사결정 AI 어시스턴트`.
- Generic English/public docs: `Operational Decision Support AI Assistant`.
- Implementation class: `tool-augmented LLM application with a deterministic decision layer`.
- Domain-specific label: `Server Monitoring / Observability AI Assistant`.
- Avoid positioning it as a full autonomous AIOps or autonomous SRE platform. Under the current project constraints, the assistant does not mutate real infrastructure; it produces evidence, reports, and action drafts for an operator to approve and execute.
- Architecture claim: deterministic means rule/contract/tool code owns metric severity, ranking, and evidence boundaries. It does not mean the LLM text layer is perfectly deterministic.

### Assistant Type Comparison
- Generic chatbot: not the primary type; OpenManager does not ask the LLM to infer metric truth from prompt text alone.
- RAG assistant: partial fit; Knowledge Retrieval Lite supports explanations, but monitoring severity and ranking come from fact/tool code.
- Tool-calling agent: strong fit; the LLM can call typed monitoring, RCA, report, advisor, vision, retrieval, and math tools.
- Autonomous agent: not a fit; the runtime does not mutate infrastructure or execute remediation without an operator.
- AIOps platform: adjacent only; live telemetry ingestion, incident workflow, and automated remediation are outside the current project boundary.

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
- `docs/development/README.md` - Development guide
- `docs/architecture/README.md` - Architecture entrypoint
- `docs/design/README.md` - Module design entrypoint
- `docs/operations/README.md` - Operations entrypoint
- `docs/reference/architecture/ai/ai-engine-architecture.md` - AI architecture
- `reports/planning/TODO.md` - Active task/backlog state

## Context Loading Order

AI coding agents should load context in this order, narrowing to the task scope:

1. `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` for agent-specific rules
2. `docs/guides/ai/ai-standards.md` for shared policy
3. `reports/planning/TODO.md` for active tasks
4. `docs/architecture/README.md` for system boundaries
5. `docs/design/README.md` for module responsibilities
6. Relevant `docs/reference/*` pages for detailed evidence
7. Relevant `reports/qa/*` entries for runtime proof

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
- Orchestrator structured routing은 Groq-first로 Cerebras RPM을 보존하며, Cerebras tool loop는 기본 비활성 + capability gate로 선제 skip

Reference (checked: 2026-05-05):
- https://vercel.com/docs/limits/overview

## Contact

- Canonical repository: GitLab private remote (`gitlab`)
- Public snapshot: github.com/skyasu2/openmanager-ai
- Version: 8.11.97
