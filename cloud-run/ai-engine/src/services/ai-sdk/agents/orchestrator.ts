/**
 * Multi-Agent Orchestrator
 *
 * Routes user queries to specialized agents using pattern matching.
 * Uses AI SDK v6 native generateText/streamText with stopWhen conditions.
 *
 * Architecture:
 * Orchestrator (Rule-based + LLM fallback) → NLQ/Analyst/Reporter/Advisor/Vision
 *
 * Split into:
 * - orchestrator-types.ts: Types, config, system prompt
 * - orchestrator-web-search.ts: Web search auto-detection
 * - orchestrator-context.ts: Context store integration, pre-filter
 * - orchestrator-execution.ts: Model selection, routing, execution
 *
 * @version 4.0.0 - Integrated BaseAgent/AgentFactory pattern
 * @updated 2026-01-30 - Split into 5 files for maintainability
 */

// ============================================================================
// Re-exports (Public API - no breaking changes for consumers)
// ============================================================================

// Types
export type {
  MultiAgentRequest,
  MultiAgentResponse,
  MultiAgentError,
  PreFilterResult,
} from './orchestrator-types';

export { ORCHESTRATOR_CONFIG } from './orchestrator-types';

// Web Search
export {
  shouldEnableWebSearch,
  resolveWebSearchSetting,
} from './orchestrator-web-search';

// Context & Pre-filter
export {
  preFilterQuery,
  saveAgentFindingsToContext,
} from './orchestrator-context';

// Execution (Main Entry Points)
export {
  executeMultiAgent,
  executeMultiAgentStream,
  getRecentHandoffs,
} from './orchestrator-execution';
