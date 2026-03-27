/**
 * AI SDK Services
 *
 * Central export point for Vercel AI SDK services.
 * Replaces LangGraph-based agents.
 *
 * @version 2.0.0 - Removed OpenRouter and Summarizer Agent
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

// Individual Agent Configs
export { getNlqAgentConfig, isNlqAgentAvailable } from './agents/nlq-agent';
export { getAnalystAgentConfig, isAnalystAgentAvailable } from './agents/analyst-agent';
export { getReporterAgentConfig, isReporterAgentAvailable, generateHighQualityReport } from './agents/reporter-agent';
export { getAdvisorAgentConfig, isAdvisorAgentAvailable } from './agents/advisor-agent';
