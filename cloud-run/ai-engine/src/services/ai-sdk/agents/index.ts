/**
 * Conditional multi-agent escalation with AI SDK v6 + BaseAgent pattern
 *
 * Architecture:
 * - BaseAgent: Abstract base class for unified agent interface
 * - AgentFactory: Factory for creating agent instances
 * - Orchestrator: Rule-based + LLM fallback routing for complex requests
 *
 * Agents:
 * - Metrics Query Agent (Groq -> Cerebras -> Mistral): metric lookup, filtering, ranking, and summaries
 * - Analyst Agent (Cerebras -> Groq -> Mistral): Anomaly detection, trend prediction
 * - Reporter Agent (Cerebras -> Groq -> Mistral): Incident reports, timelines
 * - Advisor Agent (Cerebras -> Groq -> Mistral): Troubleshooting guides, Knowledge Retrieval Lite
 * - Vision Agent (Gemini): Screenshot/image analysis
 * - Evaluator Agent: Report quality evaluation (internal)
 * - Optimizer Agent: Report quality improvement (internal)
 *
 * All agents extend BaseAgent and use AI SDK v6 ToolLoopAgent internally
 * with stopWhen conditions for graceful termination.
 *
 * @version 5.0.0 - ToolLoopAgent adoption, ConfigBasedAgent consolidation
 * @updated 2026-02-16 - ToolLoopAgent migration, removed per-type subclasses
 */

// ============================================================================
// Core Classes and Types
// ============================================================================

export { BaseAgent, type AgentResult, type AgentRunOptions, type AgentStreamEvent } from './base-agent';
export {
  AgentFactory,
  runAgent,
  streamAgent,
  type AgentType,
  AGENT_TYPE_TO_CONFIG_KEY,
  CONFIG_KEY_TO_AGENT_TYPE,
} from './agent-factory';

// ============================================================================
// Orchestrator (Main Entry Point)
// ============================================================================

export {
  executeMultiAgent,
  executeMultiAgentStream,
  getRecentHandoffs,
  preFilterQuery,
  resolveRAGSetting,
  shouldEnableWebSearch,
  resolveWebSearchSetting,
  type MultiAgentRequest,
  type MultiAgentResponse,
} from './orchestrator';

// ============================================================================
// Individual Agent Exports
// ============================================================================

// Metrics Query Agent
export {
  createMetricsQueryAgent,
  createNlqAgent,
} from './nlq-agent';

// Analyst Agent
export {
  createAnalystAgent,
} from './analyst-agent';

// Reporter Agent
export {
  createReporterAgent,
  generateHighQualityReport,
} from './reporter-agent';

// Advisor Agent
export {
  createAdvisorAgent,
} from './advisor-agent';

// Vision Agent
export {
  createVisionAgent,
  isVisionQuery,
  getVisionAgentOrFallback,
} from './vision-agent';

// ============================================================================
// Reporter Pipeline (Evaluator-Optimizer Pattern)
// ============================================================================

export {
  executeReporterPipeline,
  type PipelineResult,
  type PipelineConfig,
} from './reporter-pipeline';

// ============================================================================
// Configuration (SSOT)
// ============================================================================

export {
  AGENT_CONFIGS,
  type AgentConfig,
  type ModelResult,
  getAgentNames,
  getAgentConfig,
  isAgentAvailable,
  getAvailableAgents,
} from './config';

// ============================================================================
// Zod Schemas (Type-Safe Structured Output)
// ============================================================================

export {
  routingSchema,
  taskDecomposeSchema,
  anomalySchema,
  incidentReportSchema,
  serverQueryResultSchema,
  recommendationSchema,
  type RoutingDecision,
  type TaskDecomposition,
  type Subtask,
  type AnomalyResult,
  type IncidentReport,
  type ServerQueryResult,
  type Recommendation,
  AGENT_NAMES,
  type AgentName,
} from './schemas';

// ============================================================================
// Agent Availability Check (Debugging)
// ============================================================================

/**
 * Get available agents status for debugging
 *
 * @returns Object with agent names and their availability
 */
export function getAvailableAgentsStatus(): {
  agents: Record<string, boolean>;
  count: number;
  details: string[];
} {
  const status = AgentFactory.getAvailabilityStatus();

  const agents: Record<string, boolean> = {
    'Metrics Query Agent': status.nlq,
    'Analyst Agent': status.analyst,
    'Reporter Agent': status.reporter,
    'Advisor Agent': status.advisor,
    'Vision Agent': status.vision,
    'Evaluator Agent': status.evaluator,
    'Optimizer Agent': status.optimizer,
  };

  const available = Object.entries(agents)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return {
    agents,
    count: available.length,
    details: available,
  };
}

// Re-import AgentFactory for the function above
import { AgentFactory } from './agent-factory';
