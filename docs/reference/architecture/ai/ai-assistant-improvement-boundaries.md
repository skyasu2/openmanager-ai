# AI Assistant Improvement Boundaries

> Owner: project
> Status: Active Supporting
> Doc type: Decision Record
> Last reviewed: 2026-05-19
> Canonical: docs/reference/architecture/ai/ai-assistant-improvement-boundaries.md
> Tags: ai,assistant,boundary,free-tier,portfolio

## Purpose

This document records what should not be treated as an active improvement target for OpenManager AI Assistant under the current project assumptions.

Current assumptions:

- The project is a learning and portfolio result, not a commercial production product.
- Deployed runtime must stay within Free Tier or Free Tier-like limits. Vercel Pro is allowed only as a limited exception, not as the default solution to quality problems.
- Monitoring data is based on pre-generated OTel replay data, not live customer telemetry.
- Runtime providers are Free Tier-oriented: Groq Llama 4 Scout, Z.AI GLM Flash, Mistral Small, Cerebras `llama3.1-8b` until its 2026-05-27 cutoff, and Gemini Flash-Lite with Z.AI Vision as the vision fallback route.
- The target quality pattern is domain-grounded assistant behavior: deterministic facts first, LLM explanation second.
- The assistant is intentionally advisory. It can generate evidence, reports, commands, and action drafts, but real infrastructure changes require an operator outside the AI runtime.
- UI positioning is "core server monitoring product + attached AI Assistant module." The Dashboard, server cards, server detail, logs, alerts, and topology should remain readable as monitoring product surfaces without per-entity AI execution buttons. AI execution UI belongs to the global AI sidebar and `/dashboard/ai-assistant`.
- If recent dashboard code adds per-entity AI CTAs, treat that as surface-boundary drift rather than a reason to move more AI controls into monitoring screens. Preserve monitoring UX improvements such as server-detail routing, status badges, and sparklines, but remove the inline AI execution entry points and their obsolete test expectations.

Generic positioning:

- Korean: `운영 의사결정 AI 어시스턴트`
- English: `Operational Decision Support AI Assistant`
- Implementation class: `tool-augmented LLM application with a deterministic decision layer`
- Domain instantiation: `Server Monitoring / Observability AI Assistant`

In this document, "not possible" means not possible without changing these assumptions. "Not recommended" means technically possible but misaligned with cost, portfolio, or reliability goals.

## Non-Actionable Or Not Recommended

| Item | Decision | Why | Acceptable alternative |
|------|----------|-----|------------------------|
| GPT-4o/GPT-5-level general intelligence from the current runtime | Not possible under current model policy | Current runtime uses small/medium free-tier models. Tooling can improve domain accuracy, but it cannot turn these models into frontier general reasoning models. | Treat model intelligence as roughly GPT-3.5+ to GPT-4o-mini-near for domain tasks, and improve grounding/evals instead. |
| Datadog/Dynatrace/New Relic enterprise AIOps parity | Not possible under current data and cost model | Enterprise AIOps depends on live metrics/logs/traces, topology, alert history, incident workflow, permissions, audit, and long-term telemetry storage. | Build a portfolio-grade observability copilot with replay data, typed artifacts, evidence refs, and targeted QA. |
| Fully autonomous SRE/remediation agent | Not recommended by design | The project has no real production infrastructure authority, approval workflow, rollback control, or blast-radius guard for autonomous changes. Without those controls, autonomous remediation would be performative rather than operationally meaningful. | Keep the assistant advisory. Generate evidence-backed actions, commands, and reports, but require human execution. |
| Always-on live OTel ingestion, TSDB, and collector stack | Not recommended now | Prometheus/Mimir/Loki/Tempo/Elastic-style operation increases cost and operational scope beyond the current Free Tier replay model. | Keep `replay-json` as the default and maintain only disabled `live-otel` skeletons or adapters. |
| Make every query multi-agent or reasoning-heavy | Not recommended | Multi-agent paths multiply LLM calls, latency, and quota pressure. Simple metric/status queries are better handled by deterministic or single-agent paths. | Use multi-agent only for RCA/report/vision/advisory/cross-domain evidence escalation. |
| Put AI execution CTAs on every server card, detail header, or alert row | Not recommended for the product story | The portfolio concept is a self-built monitoring product with an attached AI module. Per-entity AI buttons make the monitoring surface look dependent on AI instead of showing that AI was added as a separate assistant/agent capability. | Keep the global AI Assistant entry, `AISidebarV4`, and `/dashboard/ai-assistant` as the AI execution surfaces. Core monitoring surfaces can still expose server/detail/log/alert navigation. |
| Use a paid single frontier provider as the default quality fix | Not recommended under current assumptions | It conflicts with the Free Tier production principle and makes the portfolio less about architecture/eval quality. | Keep provider-neutral policy and use paid/frontier models only for local development analysis or separately approved experiments. |
| Promise provider-native reasoning as a product feature | Not recommended now | Provider-native reasoning support varies by provider, model, account entitlement, quota, and latency. Current `thinking` mode is an app-level routing intensity toggle. | Add `reasoningCapability` and freshness metadata first, then consider opt-in provider-specific experiments. |
| Production-grade compliance/SLA/security posture | Not possible as a portfolio artifact | A real commercial SLA requires legal, operational, incident response, support, compliance, access review, and audit processes outside this repo. | Document security boundaries, avoid secret leakage, keep deterministic tests, and present the result as a portfolio prototype. |

## Revisit Triggers

Only revisit the decisions above when one of these inputs changes.

| Trigger | Required follow-up |
|---------|--------------------|
| Paid model/API budget is explicitly approved for deployed runtime | Create or update a provider policy plan before changing defaults. Include cost limits, fallback behavior, and QA evidence. |
| Real telemetry ingestion becomes a project goal | Update `monitoring-ai-data-source-plan.md` or create a new approved live telemetry plan with storage, retention, and cost gates. |
| Autonomous actions become a requirement | Add human approval, dry-run, rollback, audit, and permission contracts before any tool can mutate infrastructure. |
| Public portfolio demo needs stronger story value | Prefer artifact replay, evidence UI, and saved QA runs over expensive model upgrades. |
| Provider-native reasoning becomes stable in the chosen free-tier account | Add capability metadata, freshness checks, and targeted smoke evidence before exposing it beyond an opt-in experiment. |

## Allowed Improvement Direction

The allowed path is to improve the assistant around the model, not to assume a stronger model.

- Add production-sample evals for artifact intent and route decisions.
- Record planner shadow drift and latency from QA or production-like logs.
- Surface provider/model/fallback evidence in the UI.
- Turn incident, monitoring, and snapshot outputs into typed, replayable artifacts.
- Expand `MonitoringFactPack` consumption across report, artifact, and evidence UI.
- Keep AI execution controls concentrated in the sidebar/full-page AI module while letting the monitoring dashboard stand alone.
- Separate soft health/cold-start degraded states from real AI execution failures.
- Keep external LLM calls out of deterministic CI and limit real provider checks to targeted QA.

Related work plan: [AI Assistant Architecture Evolution Plan](../../../../reports/planning/archive/ai-assistant-architecture-evolution-plan.md).
Dashboard surface follow-up: [Dashboard AI Surface Boundary Plan](../../../../reports/planning/archive/dashboard-ai-surface-boundary-plan.md).
Current improvement cycle: [AI Assistant Improvement Plan (2026-05-19)](../../../../reports/planning/ai-assistant-improvement-plan.md) — hot file 재분할 및 frontend-backend-comparison LOC drift 정리. 본 boundaries 문서의 Free Tier/advisory/positioning 원칙을 변경하지 않음.
