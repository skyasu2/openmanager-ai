/**
 * Agent Config Exports
 *
 * Central export point for agent configurations.
 *
 * @version 1.0.0
 */

export {
  AGENT_CONFIGS,
  AGENT_NAMES,
  getAgentNames,
  getAgentConfig,
  isAgentName,
  isAgentAvailable,
  getAvailableAgents,
  type AgentConfig,
  type AgentName,
  type ModelResult,
} from './agent-configs';

export {
  NLQ_INSTRUCTIONS,
  ANALYST_INSTRUCTIONS,
  REPORTER_INSTRUCTIONS,
  ADVISOR_INSTRUCTIONS,
} from './instructions';
