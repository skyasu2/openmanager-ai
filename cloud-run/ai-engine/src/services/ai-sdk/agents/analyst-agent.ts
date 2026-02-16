/**
 * Analyst Agent
 *
 * Specializes in anomaly detection, trend prediction, and pattern analysis.
 * Provides deep insights into system behavior.
 *
 * Model: Groq llama-3.3-70b (primary) / Cerebras (fallback) / Mistral
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
 * Get Analyst Agent configuration
 * Use with orchestrator's executeForcedRouting or executeAgentStream
 *
 * @deprecated Use AgentFactory.create('analyst') instead
 */
export function getAnalystAgentConfig(): AgentConfig | null {
  const config = AGENT_CONFIGS['Analyst Agent'];
  if (!config) {
    logger.error('❌ [Analyst Agent] Config not found in AGENT_CONFIGS');
    return null;
  }
  return config;
}

/**
 * Check if Analyst Agent is available (has valid model)
 *
 * @deprecated Use AgentFactory.isAvailable('analyst') instead
 */
export function isAnalystAgentAvailable(): boolean {
  return AgentFactory.isAvailable('analyst');
}

/**
 * Create a new Analyst Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAnalystAgent();
 * if (agent) {
 *   const result = await agent.run('이상 징후 있어?');
 *   console.log(result.text);
 * }
 * ```
 */
export function createAnalystAgent(): BaseAgent | null {
  return AgentFactory.create('analyst');
}
