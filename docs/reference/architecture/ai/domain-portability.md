# AI 도메인 이식성 가이드

> OpenManager AI Assistant를 다른 도메인으로 이식할 때의 구현 기준
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-17
> Canonical: docs/reference/architecture/ai/domain-portability.md
> Tags: ai,domain-portability,artifacts,frontend,cloud-run

## Purpose

이 문서는 OpenManager AI Assistant 구현을 참조해 다른 도메인의 AI 어시스턴트를 만들 때 필요한 backend/frontend 경계를 설명한다.

범위는 “같은 앱에 여러 도메인을 동시에 운영하는 제품 기능”이 아니라, 현재 구현을 다른 도메인 프로젝트로 포팅하거나 새 도메인 shell을 만들 때의 기준이다.

## Current Shape

```text
User
  |
  v
Next.js frontend / BFF
  |-- chat UI and stream transport
  |-- artifact intent and client-side artifact execution
  |-- artifact renderer registry
  |
  v
Cloud Run AI Engine
  |-- AssistantDomain domain pack
  |-- deterministic routing and evidence providers
  |-- domain tools and fact pack
  `-- Vercel AI SDK v6 provider execution
```

Backend is already domain-pack oriented. Frontend now separates the shared artifact base contract from monitoring-specific artifact unions and routes card rendering/execution through registries.

## Portability Layers

| Layer | Current owner | Portable contract |
|---|---|---|
| Backend domain pack | `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts` | `AssistantDomain` |
| Backend runtime host | `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.ts` | domain-agnostic host around `AssistantDomain` |
| Frontend artifact base | `src/lib/ai/chat-artifacts/types.ts` | `ChatArtifact` base interface + `ArtifactEnvelope<T>` |
| Frontend domain artifact types | `src/lib/ai/domains/monitoring/artifact-registry.ts` | domain-specific artifact union |
| Frontend renderer registry | `src/lib/ai/domain-renderers/artifact-renderer-registry.ts` | `registerArtifactRenderer()` |
| Frontend executor registry | `src/lib/ai/chat-artifacts/artifact-executor-registry.ts` | `registerArtifactExecutor()` |

## Backend Domain Pack

The backend extension point is `AssistantDomain`.

```typescript
export interface AssistantDomain {
  id: string;
  version: string;
  instructions: DomainInstructionSet;
  routingPolicy: RoutingPolicy;
  tools: ToolRegistry;
  artifacts?: ArtifactRegistry;
  facts?: FactPackBuilder;
  agentRoles?: AgentRoleRegistry;
  dataSource?: DomainDataSource;
  capabilities?: DomainCapabilityManifest;
  intentParser?: DomainIntentParser;
  evidenceProviders?: DomainEvidenceProvider[];
}
```

Minimum backend files for a new domain:

| File | Purpose |
|---|---|
| `cloud-run/ai-engine/src/domains/<domain>/domain-pack.ts` | Export the `AssistantDomain` object |
| `cloud-run/ai-engine/src/domains/<domain>/instructions.ts` | Domain system prompt and locale policy |
| `cloud-run/ai-engine/src/domains/<domain>/tools.ts` | Tool registry and deterministic tool implementations |
| `cloud-run/ai-engine/src/domains/<domain>/capabilities.ts` | Intent/capability manifest |
| `cloud-run/ai-engine/src/domains/<domain>/evidence-providers.ts` | Deterministic evidence providers and fallback text |

Optional files:

| File | When needed |
|---|---|
| `data-source.ts` | The domain needs snapshots/history from a domain dataset |
| `artifact-registry.ts` | The backend emits structured artifacts |
| `intent-parser.ts` | Regex or structured intent extraction should happen before LLM routing |
| `agent-roles.ts` | The domain has named specialist roles |

Reference implementations:

- Monitoring production domain: `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts`
- Non-monitoring smoke fixture: `cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts`

## Frontend Artifact Contract

Shared frontend code must depend on the base contract only.

```typescript
export interface ChatArtifact extends ArtifactContractMetadata {
  kind: string;
  generatedAt: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface ArtifactEnvelope<TArtifact extends ChatArtifact = ChatArtifact> {
  domainId?: string;
  artifactVersion: string;
  kind: TArtifact['kind'];
  generatedAt: string;
  sourceMode: ArtifactSourceMode;
  payload: TArtifact;
}
```

Domain-specific unions live under the domain folder.

```typescript
export type MonitoringChatArtifact =
  | IncidentReportArtifact
  | MonitoringAnalysisArtifact
  | ServerMonitoringAnalysisArtifact
  | ServerSnapshotArtifact
  | OpsProcedureArtifact;
```

Do not add new domain artifact unions back into `src/lib/ai/chat-artifacts/types.ts`. That file is the base contract and legacy monitoring interface compatibility surface.

## Frontend Renderer Flow

```text
artifact metadata
  |
  v
resolveArtifactRendererEntries()
  |
  v
domainId + artifactKind + artifactVersion
  |
  v
registered renderer
  |
  v
ArtifactRendererHost
```

Minimum renderer files for a new domain:

| File | Purpose |
|---|---|
| `src/lib/ai/domains/<domain>/artifact-registry.ts` | Domain artifact union and kind constants |
| `src/components/ai/domain-renderers/<domain>-artifact-renderers.tsx` | Register renderer functions |
| `src/components/ai/<DomainArtifactCard>.tsx` | User-facing artifact card UI |

Renderer registration pattern:

```tsx
registerArtifactRenderer(
  {
    domainId: 'stock-analysis',
    artifactKind: 'stock-risk-report',
    artifactVersion: '2026-05-17-v1',
  },
  (artifact) => <StockRiskReportCard artifact={artifact as StockRiskReportArtifact} />,
  { isPayload: isStockRiskReportArtifact }
);
```

`isPayload` is optional for simple base artifacts, but should be provided for domain cards that accept richer payloads. Unknown renderer keys resolve to `UnsupportedArtifactFallback`; invalid payloads resolve to the same fallback with `invalid_payload`.

## Frontend Executor Flow

```text
ChatArtifactIntent
  |
  v
resolveArtifactExecutor(kind)
  |
  v
domain executor
  |
  v
ChatArtifact
  |
  v
ArtifactEnvelope + renderer metadata
```

Minimum executor files for a new domain:

| File | Purpose |
|---|---|
| `src/lib/ai/domains/<domain>/artifact-executors.ts` | Register artifact executors |
| `src/lib/ai/chat-artifacts/<domain>-artifact.ts` | Generate or fetch the artifact payload |
| `src/hooks/ai/core/chat-artifact-guidance.ts` or equivalent | Map domain intent to execution when the UI should trigger it |

Executor registration pattern:

```typescript
registerArtifactExecutor({ kind: 'stock-risk-report' }, async (context) => {
  return generateStockRiskReportArtifact({
    query: context.query,
    sessionId: context.sessionId,
    signal: context.signal,
    ...(context.queryAsOfDataSlot && {
      queryAsOfDataSlot: context.queryAsOfDataSlot,
    }),
  });
});
```

For follow-up edits, use `context.readPreviousArtifact(kind)` and keep any domain-specific narrowing inside the domain executor.

## Five-file Porting Checklist

For a new domain shell, create these first:

| Step | File | Done when |
|---|---|---|
| 1 | `cloud-run/ai-engine/src/domains/<domain>/domain-pack.ts` | `AssistantDomain` compiles and test fixture can route one request |
| 2 | `cloud-run/ai-engine/src/domains/<domain>/tools.ts` | At least one deterministic tool returns typed facts |
| 3 | `src/lib/ai/domains/<domain>/artifact-registry.ts` | Domain artifact union is outside shared `ChatArtifact` |
| 4 | `src/lib/ai/domains/<domain>/artifact-executors.ts` | `registerArtifactExecutor()` can produce one artifact |
| 5 | `src/components/ai/domain-renderers/<domain>-artifact-renderers.tsx` | `registerArtifactRenderer()` displays the artifact card |

Then add tests in this order:

1. Backend domain runtime smoke: one request routes without monitoring imports.
2. Frontend renderer registry: one custom artifact renders through `ArtifactRendererHost`.
3. Frontend executor registry: one intent resolves through `resolveArtifactExecutor()`.
4. Boundary contract: shared `ChatArtifact` does not import or union the new domain.

## Example Domain Shells

### Stock Analysis Domain

```text
Domain id: stock-analysis
Artifact kinds:
  - stock-risk-report
  - portfolio-snapshot

Backend capabilities:
  - price_lookup
  - volatility_summary
  - portfolio_risk

Frontend cards:
  - StockRiskReportCard
  - PortfolioSnapshotCard
```

Use deterministic market fixtures or mocked provider responses in CI. Real market API calls should be opt-in QA only because prices, availability, and vendor limits are temporally unstable.

### Code Review Domain

```text
Domain id: code-review
Artifact kinds:
  - review-findings
  - patch-risk-summary

Backend capabilities:
  - diff_summary
  - risk_classification
  - test_gap_detection

Frontend cards:
  - ReviewFindingsCard
  - PatchRiskSummaryCard
```

Keep repository reads local and deterministic for CI. External repository APIs or LLM review calls should be integration QA, not baseline tests.

## Current Stack Assumptions

| Area | Current baseline |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind |
| Chat transport | `@ai-sdk/react` `useChat` with custom transport |
| Backend AI runtime | Cloud Run + Hono + Vercel AI SDK v6 |
| Agent style | Deterministic-first Direct Router + tool-loop specialist agents |
| Provider policy | Free Tier-oriented provider mesh and explicit fallback metadata |
| Artifact UI | React cards rendered through registry entries |
| Test strategy | Vitest/MSW/contract tests; live provider calls only in targeted QA |

## Do And Do Not

| Do | Do not |
|---|---|
| Keep shared contracts domain-neutral | Add new domain unions to `ChatArtifact` |
| Keep deterministic evidence before LLM synthesis | Make every request multi-agent by default |
| Register frontend renderers/executors from domain modules | Add a central `switch(kind)` for every domain |
| Use `domainId + artifactKind + artifactVersion` as renderer identity | Match only on `kind` when versions can drift |
| Keep live external calls out of deterministic CI | Make CI depend on LLM, market, or remote SaaS responses |
| Preserve Free Tier limits in deployed runtime | Fix quality by defaulting to paid frontier models |

## Validation Commands

```bash
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
npm run docs:budget
npm run docs:ai-consistency
```

For backend-only domain changes:

```bash
cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm run test
```

