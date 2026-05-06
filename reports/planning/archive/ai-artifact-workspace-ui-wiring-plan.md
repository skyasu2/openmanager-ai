> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant, artifact-workspace, replay-pack, frontend, qa

# AI Artifact Workspace UI Wiring and Compare UX Plan

## 1. Context

This plan promotes the `AI artifact workspace UI wiring and compare UX` backlog item from `reports/planning/TODO.md`.

Completed baseline:

- #296: artifact schema registry and replay pack core
- #297: session store and legacy extraction path
- #298: export/import/compare adapter

Current remaining scope is not another storage or AI-provider feature. The next step is to expose the deterministic replay-pack workflow in the portfolio-facing AI workspace and harden renderer boundaries so imported or restored artifacts cannot crash UI cards.

## 2. Goal

- Add a usable artifact workspace UI boundary for saving current chat artifacts, listing local replay packs, exporting JSON, importing JSON, and comparing two replay packs.
- Keep the workflow local/session-first.
- Preserve the project rule that this surface does not introduce default database writes, new LLM calls, or provider calls.
- Fix the renderer validation gap before user-facing import/compare can surface restored payloads.
- Keep the UI deterministic and testable with local unit/integration tests.

## 3. Non-goals

- No Supabase or remote artifact persistence.
- No new AI provider, LLM, embedding, or retrieval calls.
- No arbitrary artifact execution sandbox.
- No multi-agent role/prompt externalization.
- No production deployment unless requested after implementation.

## 4. Contract

### 4.1 Runtime Boundary

| Boundary | Input | Output | Required behavior |
| --- | --- | --- | --- |
| `resolveArtifactRendererEntries(metadata)` | Unknown assistant metadata | Renderer entries or unsupported fallback entries | Validate payload with the schema registry before passing data to typed artifact cards. Malformed payloads with a supported `kind` must be treated as unsupported. |
| `extractArtifactReplayPackFromChatHistory()` | Chat history messages and workspace id | Normalized replay pack | Extract supported `artifactEnvelopes` and legacy metadata. Drop unsupported entries safely. Do not mutate chat state. |
| `createArtifactWorkspaceStore()` | Browser storage-like adapter | Local workspace store | Default to session storage. Do not write to DB. Preserve existing `local-session-first` policy. |
| `createArtifactReplayPackExport()` | Replay pack | JSON export payload | Produce deterministic, versioned replay pack export data. |
| `readArtifactReplayPackExport()` | JSON text or parsed JSON | Import result | Reject invalid JSON and unsupported export versions. Normalize entries through the schema registry. |
| Artifact workspace UI | Current messages, local store, file input | Save/export/import/compare actions and status UI | No network fetch, no DB write, no LLM/provider call. |

### 4.2 UI Contract

The workspace UI must expose these states:

- Empty: no supported artifacts in current chat or local store.
- Ready: local replay packs are available.
- Saving: current chat artifacts can be saved into a local replay pack.
- Exporting: selected replay pack can be exported as JSON.
- Importing: JSON file selection is parsed and validated.
- Comparing: two selected replay packs render a comparison summary.
- Error: invalid JSON, unsupported export version, no selected pack, or no supported artifact entries.

The compare interaction must use explicit user selection:

- Compare requires two different replay packs.
- If fewer than two packs are available, compare controls remain disabled.
- If the same pack is selected for both sides, the UI must show an error state instead of comparing.
- Selected packs must be compared with deterministic replay-pack data only. The compare action must not read chat messages, call network APIs, or mutate stored replay packs.

Expected compare fields:

- matched entries
- missing entries
- added entries
- changed entries
- ignored or unsupported entries, if exposed by the finalized import behavior

### 4.3 Invariants

- Imported or restored payloads must never bypass schema validation.
- Unsupported artifacts must never be passed to typed renderer cards.
- Session store writes must stay local to `sessionStorage` unless a test injects a storage adapter.
- Export/import/compare must be deterministic and testable without a browser network.
- UI tests must prove no `fetch`, DB client, AI route, LLM, or provider adapter call is required for the workflow.
- Import uses browser file selection only; parsing happens in the component/hook boundary and then delegates to the existing replay-pack import helper.

## 5. Target Files

Expected implementation files:

- `src/lib/ai/domain-renderers/artifact-renderer-registry.ts`
- `src/lib/ai/domain-renderers/artifact-renderer-registry.test.ts`
- `src/lib/ai/chat-artifacts/artifact-workspace-store.ts`
- `src/lib/ai/chat-artifacts/artifact-workspace-store.test.ts`
- `src/components/ai/artifact-workspace/ArtifactWorkspacePanel.tsx`
- `src/components/ai/artifact-workspace/ArtifactWorkspacePanel.test.tsx`
- `src/components/ai/AIWorkspace.tsx` or the narrow child component that owns the AI workspace surface

Optional implementation files if the existing component boundary needs a thinner state layer:

- `src/hooks/ai/useArtifactWorkspace.ts`
- `src/hooks/ai/useArtifactWorkspace.test.ts`

## 6. Test Plan

Failing tests must be added before implementation if this plan is approved.

- Renderer registry rejects malformed payloads that only match by `kind`; unsupported fallback is returned and typed cards do not receive the payload.
- Workspace panel renders an empty state when current messages and session store contain no supported artifacts.
- Save action extracts supported artifacts from current assistant messages and persists only to the session store.
- Export action emits deterministic JSON with the expected version and replay pack payload.
- Import action rejects invalid JSON.
- Import action rejects unsupported export versions.
- Import action normalizes unsupported entries according to the finalized import contract and surfaces the result clearly.
- Compare action renders matched, missing, added, and changed counts for selected replay packs.
- Compare action is disabled when fewer than two replay packs exist.
- Compare action rejects selecting the same pack for both sides.
- Clear action removes local session workspace state.
- Unit/integration tests assert that this UI path does not call `fetch`, DB clients, AI routes, or LLM/provider adapters.

## 7. Work Breakdown

1. Add failing tests for renderer validation and artifact workspace UI behavior.
   - Commit intent: `test(spec): add artifact workspace UI wiring specs`
2. Harden artifact renderer payload validation.
   - Replace `kind`-only classification with schema-registry payload validation.
   - Remove or cover unused artifact workspace exports if they remain public.
3. Implement the artifact workspace state boundary.
   - Use existing replay-pack store helpers.
   - Keep store dependency injectable for tests.
4. Build the workspace UI.
   - Add compact controls for save, export, import, compare, and clear.
   - Use existing UI patterns and icon button conventions.
   - Keep file input hidden behind an explicit import control.
5. Wire the UI into the AI workspace surface.
   - Prefer the narrowest component boundary that already has access to chat messages.
6. Run local validation.
   - `npm run type-check`
   - `npm run lint`
   - `npm run test:quick`
   - `npm run test:contract` only if the metadata/import contract changes
7. Run focused UI QA.
   - Local dev QA is sufficient unless this is promoted into a release gate.
   - Record QA only if a formal QA run is executed.

## 8. Approval Gate

Status was `Approved` before implementation.

Implementation may start after a failing spec commit is created.

## 9. Completion Criteria

- Artifact renderer validation cannot classify malformed supported-kind payloads as safe.
- Portfolio-facing AI workspace exposes save/export/import/compare controls for replay packs.
- Invalid or unsupported imports fail visibly without corrupting local workspace state.
- Compare UX renders deterministic summary counts.
- Local deterministic validation passes.
- No new DB write path, LLM call, provider call, or production deployment is introduced by default.

## 10. Completion Log

Completed on 2026-05-06.

- Failing spec commit: `fb24b4216 test(spec): add artifact workspace UI wiring specs`
- Implementation commit: `fa5b38949 feat(ai): implement artifact workspace UI wiring`
- Renderer registry now validates supported artifact kinds through the schema registry before typed cards receive payloads.
- `ArtifactWorkspacePanel` is wired into the AI workspace side context and supports local save, list, export, import, compare, and clear actions for replay packs.
- Import remains browser-file/local-session first. No default DB write, network fetch, AI route, LLM, or provider call was added.
- Local validation:
  - `npx vitest run src/lib/ai/domain-renderers/artifact-renderer-registry.test.ts src/components/ai/artifact-workspace/ArtifactWorkspacePanel.test.tsx`
  - `npx vitest run src/components/ai/AIWorkspace.test.tsx src/components/ai/SystemContextPanel.test.tsx`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - `npm run test:contract`
  - `git diff --check`
