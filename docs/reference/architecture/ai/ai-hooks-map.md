# AI 훅 맵

> AI Assistant frontend hook entry map
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-19
> Canonical: docs/reference/architecture/ai/ai-hooks-map.md
> Tags: ai,frontend,hooks,architecture

이 문서는 AI Assistant frontend hook의 진입점과 책임 경계를 한 장으로 정리합니다. Cloud Run agent/tool/runtime 상세는 [AI Engine Architecture](./ai-engine-architecture.md), frontend/backend 책임 비교는 [Frontend vs Backend AI Assistant 비교 분석](./frontend-backend-comparison.md)을 우선합니다.

## Entry Flow

```
AISidebarV4 / AIWorkspace / artifact cards
  ├─ useAIChatSurface        store slice + selected function
  ├─ useAIEntryController    sidebar/fullscreen handoff
  └─ useAIChatCore           shared chat session and send orchestration
       ├─ useHybridAIQuery              stream/job routing and transport
       │    └─ useAsyncAIQuery          job queue lifecycle and SSE result
       ├─ useEnhancedChatMessages       message metadata -> render model
       └─ useDeferredMessageMetadata    stream done metadata buffering

ChatInputArea / useChatActions
  └─ useFileAttachments      image/PDF/markdown attachment state

DeveloperPanel
  └─ useDeveloperPanel       normalized developer diagnostics JSON
```

## Hook Matrix

| Hook | Primary caller | Owns | Does not own |
|------|----------------|------|--------------|
| `useAIChatCore` | `AISidebarV4`, `AIWorkspace` | session id, local input/error, queue handoff, artifact pre-routing, shared return contract | sidebar chrome, fullscreen routing, file selection UI |
| `useAIChatSurface` | `AISidebarV4`, `AIWorkspace` | selected function, web search toggle, analysis mode, pending entry/prefill store slice | chat message state, transport, artifact execution |
| `useAIEntryController` | sidebar/workspace entry buttons, artifact cards | sidebar open/close, fullscreen navigation, pending entry target handoff | chat generation, selected function state |
| `useHybridAIQuery` | `useAIChatCore` | streaming/job routing, AI SDK `useChat`, stream callbacks, rate-limit cooldown, clarification bridge | input validation, artifact intent routing, rendered message enrichment |
| `useAsyncAIQuery` | `useHybridAIQuery` | `/api/ai/jobs` request, `/api/ai/jobs/:id/stream` SSE, progress/result/error settlement | streaming `useChat`, UI message transformation |
| `useEnhancedChatMessages` | `useAIChatCore` | raw `UIMessage[]` plus deferred metadata/tool results into render-ready messages | transport, persistence, artifact generation |
| `useDeferredMessageMetadata` | `useAIChatCore` stream data path | trace ids, pending stream tool results, deferred metadata flush to assistant message id | semantic parsing, source/evidence rendering |
| `useDeveloperPanel` | `DeveloperPanel` | normalize developer panel payload and JSON display string | data collection, transport metadata creation |
| `useFileAttachments` | `useChatActions`, `ChatInputArea` | file validation, drag state, data URL conversion, attachment list | sending query, Vision routing decision |

## State Boundaries

| State | Canonical owner | Consumer path |
|-------|-----------------|---------------|
| Sidebar open/fullscreen handoff | `useAIEntryController` + `useAISidebarStore` | `AISidebarV4`, `AIWorkspace`, artifact cards |
| Selected AI surface function | `useAIChatSurface` | sidebar/workspace shell |
| Chat messages and session snapshot | `useAIChatCore` | sidebar/workspace message renderers, persisted sidebar store snapshot |
| Stream/job route state | `useHybridAIQuery` | `useAIChatCore` return `hybridState`, progress UI |
| Job queue progress/result | `useAsyncAIQuery` | `useHybridAIQuery` onResult/onProgress callbacks |
| Deferred metadata/tool results | `useDeferredMessageMetadata` | `useEnhancedChatMessages` |
| Attachments | `useFileAttachments` | `useChatActions` -> `handleSendInput` -> `useAIChatCore` |
| Developer diagnostics | `useDeveloperPanel` | `DeveloperPanel` |

## Current LOC Snapshot

Measured with `wc -l` on 2026-05-19.

| Hook file | Lines |
|-----------|------:|
| `src/hooks/ai/useAIChatCore.ts` | 578 |
| `src/hooks/ai/useAIChatSurface.ts` | 77 |
| `src/hooks/ai/useAIEntryController.ts` | 62 |
| `src/hooks/ai/useHybridAIQuery.ts` | 523 |
| `src/hooks/ai/useAsyncAIQuery.ts` | 599 |
| `src/hooks/ai/useEnhancedChatMessages.ts` | 126 |
| `src/hooks/ai/useDeferredMessageMetadata.ts` | 209 |
| `src/hooks/ai/useDeveloperPanel.ts` | 20 |
| `src/hooks/ai/useFileAttachments.ts` | 383 |
