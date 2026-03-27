/**
 * Advisor Agent
 *
 * Specializes in troubleshooting guidance and command recommendations.
 * Uses GraphRAG to search past incidents and best practices.
 *
 * Model: Mistral mistral-large-3-25-12 (primary - RAG + reasoning)
 * Fallback: Groq → Cerebras
 *
 * @version 4.0.0 - Migrated to BaseAgent pattern
 * @created 2025-12-01
 * @updated 2026-01-27 - BaseAgent/AgentFactory migration
 */

import { AGENT_CONFIGS, type AgentConfig } from './config';
import { AgentFactory, type BaseAgent } from './agent-factory';
import { logger } from '../../../lib/logger';

// ============================================================================
// Factory Functions (Backward Compatibility)
// ============================================================================

/**
 * Get Advisor Agent configuration
 * Use with orchestrator's executeForcedRouting or executeAgentStream
 *
 * @deprecated Use AgentFactory.create('advisor') instead
 */
export function getAdvisorAgentConfig(): AgentConfig | null {
  const config = AGENT_CONFIGS['Advisor Agent'];
  if (!config) {
    logger.error('[Advisor Agent] Config not found in AGENT_CONFIGS');
    return null;
  }
  return config;
}

/**
 * Check if Advisor Agent is available (has valid model)
 *
 * @deprecated Use AgentFactory.isAvailable('advisor') instead
 */
export function isAdvisorAgentAvailable(): boolean {
  return AgentFactory.isAvailable('advisor');
}

/**
 * Create a new Advisor Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAdvisorAgent();
 * if (agent) {
 *   const result = await agent.run('메모리 부족 해결 방법');
 *   console.log(result.text);
 * }
 * ```
 */
export function createAdvisorAgent(): BaseAgent | null {
  return AgentFactory.create('advisor');
}
