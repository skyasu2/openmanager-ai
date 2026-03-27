/**
 * AI SDK Supervisor
 *
 * Dual-mode supervisor implementation:
 * 1. Single-agent mode: Simple generateText with multi-step tool calling
 * 2. Multi-agent mode: Orchestrated agent handoffs using AI SDK v6 native ToolLoopAgent
 *
 * Split into:
 * - supervisor-types.ts: Types, StreamEvent
 * - supervisor-routing.ts: Mode selection, prepareStep, intent classification
 * - supervisor-single-agent.ts: Single/multi agent execution + streaming
 * - supervisor-stream-response.ts: UIMessageStream response generation
 *
 * @version 2.0.0
 * @updated 2026-01-30 - Split into 5 files for maintainability
 */

// ============================================================================
// Re-exports (Public API - no breaking changes for consumers)
// ============================================================================

// Types
export type {
  SupervisorMode,
  SupervisorRequest,
  SupervisorResponse,
  SupervisorError,
  StreamEventType,
  StreamEvent,
  SupervisorHealth,
  ImageAttachment,
  FileAttachment,
} from './supervisor-types';

// Execution
export {
  executeSupervisor,
  executeSupervisorStream,
  checkSupervisorHealth,
} from './supervisor-single-agent';

// UIMessageStream
export {
  createSupervisorStreamResponse,
} from './supervisor-stream-response';
