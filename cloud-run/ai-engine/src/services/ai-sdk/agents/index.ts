/**
 * Multi-Agent System with AI SDK v6 Native + BaseAgent Pattern
 *
 * Architecture:
 * - BaseAgent: Abstract base class for unified agent interface
 * - AgentFactory: Factory for creating agent instances
 * - Orchestrator: Rule-based + LLM routing using generateText
 *
 * Agents:
 * - NLQ Agent (Cerebras): Natural language query processing + summaries
 * - Analyst Agent (Groq): Anomaly detection, trend prediction
 * - Reporter Agent (Groq): Incident reports, timelines
 * - Advisor Agent (Mistral): Troubleshooting guides, RAG search
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
  shouldEnableWebSearch,
  resolveWebSearchSetting,
  type MultiAgentRequest,
  type MultiAgentResponse,
} from './orchestrator';

// ============================================================================
// Individual Agent Exports (Backward Compatibility)
// ============================================================================

// NLQ Agent
export {
  getNlqAgentConfig,
  isNlqAgentAvailable,
  createNlqAgent,
} from './nlq-agent';

// Analyst Agent
export {
  getAnalystAgentConfig,
  isAnalystAgentAvailable,
  createAnalystAgent,
} from './analyst-agent';

// Reporter Agent
export {
  getReporterAgentConfig,
  isReporterAgentAvailable,
  createReporterAgent,
  generateHighQualityReport,
} from './reporter-agent';

// Advisor Agent
export {
  getAdvisorAgentConfig,
  isAdvisorAgentAvailable,
  createAdvisorAgent,
} from './advisor-agent';

// Vision Agent
export {
  getVisionAgentConfig,
  isVisionAgentAvailable,
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
    'NLQ Agent': status.nlq,
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
