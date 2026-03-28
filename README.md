# OpenManager AI

> **AI-Native Server Monitoring Platform**
> 자연어로 대화하며 서버를 모니터링하는 차세대 운영 플랫폼

[![Version](https://img.shields.io/badge/version-8.10.2-blue.svg?style=for-the-badge)](https://openmanager-ai.vercel.app)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://openmanager-ai.vercel.app)
[![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=for-the-badge)](LICENSE)

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript_5-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=flat-square&logo=supabase&logoColor=3ECF8E)
![Google Cloud](https://img.shields.io/badge/Cloud_Run-4285F4?style=flat-square&logo=google-cloud&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

---

## What is this?

OpenManager AI는 서버 모니터링의 패러다임을 **"차트 해석"에서 "질문과 답변"으로** 바꾸는 AI 기반 플랫폼입니다.

운영자는 CPU/메모리 그래프를 직접 읽는 대신, 자연어로 질문합니다:

```
"서버 상태 어때?"           → 전체 헬스 요약
"왜 web-01이 느려졌어?"     → 이상 탐지 + 원인 분석
"장애 보고서 만들어줘"      → 마크다운 리포트 자동 생성
"CPU 80% 넘는 서버 있어?"  → 메트릭 쿼리 + 필터
```

**🔗 Live Demo**: [openmanager-ai.vercel.app](https://openmanager-ai.vercel.app)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **AI Multi-Agent Chat** | 7개 실행 에이전트 + Supervisor 오케스트레이터 |
| **Real-time Dashboard** | 15개 서버 × CPU/Memory/Disk/Network 메트릭 |
| **Auto Incident Report** | 장애 감지 시 마크다운 보고서 자동 생성 |
| **Resumable Streams** | 새로고침 후에도 AI 응답 스트림 재연결 (Redis 기반) |
| **Hybrid Compute** | 빠른 UI는 Vercel Edge, AI 연산은 Cloud Run |

---

## Architecture

```
User (Natural Language Query)
    │
    ▼
┌─────────────────────────────┐
│  Vercel / Next.js 16        │  ← UI, SSR, Edge API Routes
│  React 19 + Tailwind CSS    │
└──────────────┬──────────────┘
               │ API / Streaming
               ▼
┌─────────────────────────────┐
│  Google Cloud Run           │  ← AI Engine (Node.js / Hono)
│  AI Supervisor + 7 Agents   │
│  Vercel AI SDK v6           │
└──────┬────────────┬─────────┘
       │            │
       ▼            ▼
┌──────────┐  ┌───────────────┐
│ Supabase │  │ Upstash Redis │
│ pgvector │  │ Stream Cache  │
└──────────┘  └───────────────┘
```

### AI Agent System

```
User Query → Supervisor (Intent Classification & Routing)
               │
    ┌──────────┼────────────────────┐
    ▼          ▼                    ▼
NLQ Agent  Analyst Agent       Reporter Agent
(쿼리 변환) (이상 탐지)         (보고서 생성)

Advisor Agent              Vision Agent
(조치안 제안)               (로그/이미지 분석)
```

| Agent | Model | Role |
|-------|-------|------|
| Supervisor | Cerebras llama-3.3-70b | 의도 분류, 에이전트 라우팅 |
| NLQ | Cerebras llama-3.3-70b | 자연어 → 메트릭 쿼리 변환 |
| Analyst | Cerebras llama-3.3-70b | 이상 탐지, 원인 분석 |
| Reporter | Groq llama-3.1-8b | 장애 보고서 생성 |
| Advisor | Mistral mistral-small | 운영 가이드, 조치안 제안 |
| Vision | Gemini 1.5-flash | 로그/이미지 분석 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.1, React 19.2, TypeScript 5.9 |
| **Styling** | Tailwind CSS v3, shadcn/ui, Framer Motion |
| **State** | Zustand, TanStack Query |
| **AI SDK** | Vercel AI SDK v6 (streaming, multi-agent) |
| **Backend** | Hono + Node.js 20 (Cloud Run) |
| **Database** | Supabase PostgreSQL + pgvector (RAG) |
| **Cache** | Upstash Redis (stream resume, rate limit) |
| **Deployment** | Vercel Pro (Frontend) + Google Cloud Run Free (AI) |
| **Monitoring Data** | Pre-computed OTel metrics — 15 servers × 24h |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   └── api/ai/supervisor/  # AI Supervisor streaming endpoint
├── components/             # React components (dashboard, ai-sidebar, ui/)
├── hooks/                  # Custom hooks (AI, dashboard, metrics)
├── services/               # Business logic (metrics, monitoring)
├── lib/ai/                 # AI utilities (context, compression, routing)
└── stores/                 # Zustand global state

cloud-run/ai-engine/
├── src/agents/             # 7 execution agent definitions
├── src/tools/              # Agent tools (metrics, search, report gen)
└── src/data/               # Pre-computed server state for AI context

public/data/otel-data/
└── hourly/hour-XX.json     # 24h × 15 servers OTel monitoring data
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# For AI: CLOUD_RUN_AI_URL, CLOUD_RUN_API_SECRET
# For cache: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

# 3. Start development server
npm run dev        # localhost:3000

# 4. Type check + lint
npm run type-check
```

> **Note**: The dashboard and server monitoring work without AI keys, using pre-computed OTel data in `public/data/otel-data/`.
> AI chat features require valid API keys for Cerebras, Groq, Mistral, and Gemini, plus a running Cloud Run AI Engine.

---

---

## Engineering Notes

### Development Approach

Built end-to-end using **Claude Code** as the primary development tool, with Gemini CLI and OpenAI Codex as secondary review agents:

- **Multi-LLM Review**: Claude Code (implementation) → Gemini (architecture review) → Codex (refactoring)
- **MCP Integration**: 8 MCP servers connected (Context7, Playwright, Supabase, Vercel, Stitch, etc.)
- **Local CI First**: Pre-push hooks run TypeScript + Lint + Tests locally before any push
- **Free Tier Discipline**: All cloud infra within free tiers except Vercel Pro ($20/mo)

### Scale

- ~155,000 lines of code (`src/` + `cloud-run/` combined)
- 2,600+ automated tests (unit + integration)
- 15 servers × 24h × 10-minute interval pre-computed monitoring data

---

## Known Limitations

- **Cloud Run cold start**: First AI request after idle can be slow (~5-10s) on free-tier Cloud Run
- **AI scope cuts**: Analyst per-server drilldown and AI chat detail expand are deferred to future iterations

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <a href="https://openmanager-ai.vercel.app"><strong>🚀 Live Demo</strong></a>
  &nbsp;·&nbsp;
  <sub>Built with Vibe Coding · v8.10.2</sub>
</div>
