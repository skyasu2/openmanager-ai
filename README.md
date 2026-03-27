# OpenManager AI

OpenManager AI is a personal side project that explores a different way to monitor servers: instead of starting from charts, the operator starts from questions.

The application combines a Next.js frontend, an AI engine on Cloud Run, and precomputed monitoring data so that users can ask about system health, trends, and likely causes in natural language.

## Stack

- Next.js 16
- React 19
- TypeScript 5
- Vercel AI SDK v6
- Google Cloud Run
- Supabase
- Upstash Redis

## Repository Scope

This public repository focuses on the runtime application code.

Tests, QA evidence, internal operational documents, and agent/tooling configuration stay in the private canonical development repository. The public snapshot is intended to show the product code and architecture without the full private delivery history.

## Project Structure

- `src/`: Next.js app, UI components, frontend state, API routes
- `cloud-run/ai-engine/`: AI orchestration and analysis service
- `public/data/`: precomputed monitoring datasets used by the product flow

## Local Run

```bash
npm install
npm run dev
```

Some deployment-only configuration and private operational assets are intentionally not included in this public snapshot.
