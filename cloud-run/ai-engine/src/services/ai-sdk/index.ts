/**
 * AI SDK Services
 *
 * Central export point for Vercel AI SDK services.
 * Replaces LangGraph-based agents.
 *
 * @version 2.0.0 - Removed legacy router provider and Summarizer Agent
 * @updated 2026-01-12
 */

// Supervisor
export {
  executeSupervisor,
  executeSupervisorStream,
  createSupervisorStreamResponse,  // AI SDK Native UIMessageStream
  checkSupervisorHealth,
  type SupervisorRequest,
  type SupervisorResponse,
  type SupervisorError,
  type SupervisorHealth,
} from './supervisor';

// Model Provider
export {
  getSupervisorModel,
  getVerifierModel,
  getAdvisorModel,
  getCerebrasModel,
  getGroqModel,
  getMistralModel,
  checkProviderStatus,
  checkAllProvidersHealth,
  logProviderStatus,
  type ProviderName,
  type ProviderStatus,
  type ProviderHealth,
} from './model-provider';

// Multi-Agent Orchestrator
export {
  executeMultiAgent,
  executeMultiAgentStream,
  type MultiAgentRequest,
  type MultiAgentResponse,
  type MultiAgentError,
} from './agents/orchestrator';

// Reporter Pipeline (Evaluator-Optimizer Pattern)
export {
  executeReporterPipeline,
  type PipelineResult,
  type PipelineConfig,
} from './agents/reporter-pipeline';

// Individual Agent Convenience
export { createMetricsQueryAgent } from './agents/nlq-agent';
export { createAnalystAgent } from './agents/analyst-agent';
export { createReporterAgent, generateHighQualityReport } from './agents/reporter-agent';
export { createAdvisorAgent } from './agents/advisor-agent';
