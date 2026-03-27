# OpenManager AI

OpenManager AI is a personal side project built with `Next.js 16`, `React 19`, `TypeScript`, and a separate `Cloud Run` AI engine.

OpenManager AI replaces passive dashboard reading with an operational workflow built around:

- asking questions about infrastructure in natural language
- analyzing live and precomputed telemetry
- generating structured explanations and action-oriented responses

**Live app**: [openmanager-ai.vercel.app](https://openmanager-ai.vercel.app)

## What This Project Does

Traditional monitoring tools are good at showing charts. This project is focused on turning those charts into an interactive analysis surface.

Examples:

- "Which servers are under the highest CPU pressure right now?"
- "Why is this server getting slower?"
- "Generate an incident report from the current state."

The frontend handles the dashboard, interaction model, and streaming UI. The AI engine handles orchestration, route-level inference, analysis tools, and response generation.

## Core Capabilities

- Natural-language server analysis with an orchestrated multi-agent backend
- Streaming AI responses with intermediate tool activity surfaced in the UI
- Server dashboard with health summaries, metrics, alert surfaces, and detail views
- Auto-report generation for operational summaries
- Hybrid deployment model: Vercel frontend + Google Cloud Run AI backend
- Supabase-backed data and auth integration

## Architecture

### Frontend

- `Next.js App Router`
- `React 19`
- `TypeScript`
- `TanStack Query` and `Zustand`
- UI focused on dashboard state, AI chat, and operational workflows

### AI Engine

- `Hono` server running on `Google Cloud Run`
- Multi-agent orchestration and route-based AI services
- Tooling for server metrics, incident reasoning, reporting, and response composition
- Lightweight warmup and readiness handling for cold-start-aware deployment

### Data Layer

- `Supabase` for application data and auth
- `Redis`/Upstash for cache and streaming support where needed
- Precomputed telemetry snapshots used as the current source dataset for the monitoring experience

## Repository Layout

This repository is centered on the product code path:

- `src/`: frontend application code
- `cloud-run/ai-engine/src/`: AI backend code
- `public/`: runtime assets used by the app

## Technical Highlights

### 1. Split runtime architecture

The product intentionally separates interaction-heavy UI concerns from heavier AI and analysis workloads.

- Vercel handles frontend delivery and application routes
- Cloud Run isolates the AI engine and backend orchestration path

This keeps the UI deployment simple while allowing the AI layer to evolve independently.

### 2. AI as an operational interface

The interesting part of the project is not "chat on top of data." The system is designed around operational intent:

- query interpretation
- metric retrieval
- anomaly/context analysis
- structured answer generation

### 3. Production-oriented constraints

The implementation pays attention to deployment realities:

- cold-start-aware warmup flow
- streaming response handling
- readiness and health endpoints
- boundary between UI runtime and backend inference runtime

## Running Locally

Minimal local workflow:

```bash
npm install
npm run dev
```

AI engine development:

```bash
cd cloud-run/ai-engine
npm install
npm run dev
```

## About This Repository

This public repository focuses on the application and runtime code needed to understand how the project is put together.

It includes:

- application source code
- runtime configuration needed to understand the system
- deployment-facing code paths

Some project assets are intentionally left out of this mirror:

- test suites and snapshots
- internal QA evidence and review artifacts
- CI and agent-operation workflow assets
- development-only documentation not required to understand the product

## Project Note

This started as an experiment around a simple question: what if server monitoring felt less like reading dashboards and more like having an operational conversation with the system?

The project is still shaped like a real full-stack product, so the interesting parts are mostly in how the pieces connect end to end:

- UI and interaction model
- API boundaries
- AI orchestration layer
- operational tradeoffs in a real deployment shape

## License

This project is licensed under the `GPL-3.0`. See `LICENSE`.
