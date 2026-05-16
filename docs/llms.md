# OpenManager AI v8 - LLM Context

> AI 어시스턴트 컨텍스트 전달용 핵심 프로젝트 요약
> Owner: documentation
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-16
> Canonical: docs/llms.md
> Tags: llm,context,ai
>
> **v8.11.156** | Updated 2026-05-16
>
> AI 어시스턴트가 프로젝트를 이해하는 데 필요한 핵심 정보

## Project Overview

OpenManager AI is a human-in-the-loop server monitoring AI assistant built with:
- Frontend: Next.js 16, React 19, TypeScript 5.9
- AI Engine: Vercel AI SDK 6 family, deterministic/single-first advisory runtime with conditional routing-based multi-agent workflow
- Database: Supabase (PostgreSQL + Auth/RLS); Knowledge Retrieval Lite uses BM25 RPC + metadata boost
- Deployment: Vercel (Frontend) + Cloud Run (AI Engine)

Product positioning:
- Core domain: self-built synthetic server monitoring product, not a clone of a specific company product.
- AI layer: AI Assistant / Agent module attached to that monitoring domain.
- Portfolio story: demonstrate adding useful AI assistant/agent capability to an existing domain product surface, not replacing the monitoring UI with AI everywhere.
- UI boundary: AI execution controls live in the global AI sidebar and `/dashboard/ai-assistant`; server cards, server detail, alerts, logs, and topology remain core monitoring surfaces.

## Architecture

### Hybrid Architecture
```
[User] → [Vercel/Next.js] → [Cloud Run/AI Engine] → [Supabase]
              ↓                      ↓
         UI/API Proxy         AI Runtime
```

### AI Engine Components

**NLQ 전처리 파이프라인** (Vercel BFF, 2026-05-16 완료 현황):
- `ChatInputArea` UX guard: maxLength=10,000 / warning=8,000자 (N0 ✅)
- `QueryGuard` (`/api/ai/nlq/extract-entities`): 공격 패턴 차단, log_paste 감지, oversized truncate (N2 ✅)
- Groq NLQ LLM → `SemanticIntentFrame` + `executionMode` 슬롯 (N1 ✅)
- streaming output filter (`/api/ai/supervisor/stream/v2`): XSS/시스템프롬프트 유출 차단 (N4 ✅)
- 잔여: `inputType/logExtract` → Cloud Run multi 분석 경로 연결 (N3 ⬜)

**Cloud Run AI Engine**:
- Supervisor: `intentFrame.executionMode` primary 신뢰(confidence ≥ 0.8) + regex 4개 fallback 기반 mode 결정. `single` gated, `auto` complexity-based, multi-agent는 specialist escalation 시에만.
- Direct Router: `preFilterQuery()`/`resolveDirectRoutingTarget()` 기반 specialist dispatch. 기본 path에서 Orchestrator LLM routing/decomposition은 호출하지 않음.
- Agents (실행): Metrics Query, Analyst, Reporter, Advisor, Vision
- Reporter quality stages: Evaluator, Optimizer (별도 LLM agent가 아닌 deterministic pipeline 단계)
- Providers:
  - Supervisor / Metrics Query path: Groq → Z.AI → Mistral → Cerebras*
  - Analyst / Verifier path: Mistral → Groq → Z.AI → Cerebras*
  - Reporter path: Z.AI → Mistral → Groq → Cerebras*
  - Advisor path: Mistral → Z.AI → Groq → Cerebras*
  - Vision path: Gemini Flash-Lite → OpenRouter → Z.AI
  - *Cerebras `llama3.1-8b`: 2026-05-27 cutoff, `isCerebrasExpiredByDate()` graceful exit 구현 완료
- Tools: 30 specialized tools (Metrics 6, RCA 3, Analyst 4, Knowledge 3, Evaluation 6, Control 1, Vision 4, Math 3)
- Observability: Langfuse mode audit (`requestedMode`, `resolvedMode`, `modeSelectionSource`) + `handoffCount`

### Positioning Vocabulary
- Generic Korean: `운영 의사결정 AI 어시스턴트`.
- Generic English/public docs: `Operational Decision Support AI Assistant`.
- Implementation class: `tool-augmented LLM application with a deterministic decision layer`.
- Domain-specific label: `Server Monitoring / Observability AI Assistant`.
- Avoid positioning it as a full autonomous AIOps or autonomous SRE platform. Under the current project constraints, the assistant does not mutate real infrastructure; it produces evidence, reports, and action drafts for an operator to approve and execute.
- Architecture claim: deterministic means rule/contract/tool code owns metric severity, ranking, and evidence boundaries. It does not mean the LLM text layer is perfectly deterministic.

### Surface Boundary

Use this mental model when interpreting UI or proposing changes:

```
Monitoring product surfaces:
  Dashboard / Server cards / Server detail / Alerts / Logs / Topology

AI module surfaces:
  Header AI Assistant toggle / AISidebarV4 / /dashboard/ai-assistant
```

Do not assume every warning server row needs an inline AI button. The preferred pattern is that monitoring surfaces expose observable facts and navigation, while AI surfaces handle natural-language questions, agent progress, reports, artifacts, and evidence display.

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
- Orchestrator는 `generateText + Output.object` 기반 structured routing fallback helper로 라우팅 수행
- Agent 실행은 `streamText` / `generateTextWithRetry` 기반 tool loop
- Orchestrator structured routing은 Groq-first로 Z.AI/Mistral/Cerebras RPM을 보존하며, Cerebras tool loop는 기본 비활성 + 16K/32K 요구 시 capability gate로 선제 skip

Reference (checked: 2026-05-05):
- https://vercel.com/docs/limits/overview

## Contact

- Canonical repository: GitLab private remote (`gitlab`)
- Public snapshot: github.com/skyasu2/openmanager-ai
- Version: 8.11.156
