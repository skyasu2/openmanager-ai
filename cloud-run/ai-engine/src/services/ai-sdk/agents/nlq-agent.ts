/**
 * NLQ (Natural Language Query) Agent
 *
 * Handles all server data queries - from simple to complex:
 * - Simple: "서버 상태 요약", "CPU 높은 서버"
 * - Complex: "CPU > 80% AND 메모리 > 70%", "지난 1시간 에러 TOP 5"
 *
 * Model: Cerebras llama-3.3-70b (primary) - 24M tokens/day free
 * Fallback: Groq llama-3.3-70b-versatile → Mistral
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
 * Get NLQ Agent configuration
 * Use with orchestrator's executeForcedRouting or executeAgentStream
 *
 * @deprecated Use AgentFactory.create('nlq') instead
 */
export function getNlqAgentConfig(): AgentConfig | null {
  const config = AGENT_CONFIGS['NLQ Agent'];
  if (!config) {
    logger.error('[NLQ Agent] Config not found in AGENT_CONFIGS');
    return null;
  }
  return config;
}

/**
 * Check if NLQ Agent is available (has valid model)
 *
 * @deprecated Use AgentFactory.isAvailable('nlq') instead
 */
export function isNlqAgentAvailable(): boolean {
  return AgentFactory.isAvailable('nlq');
}

/**
 * Create a new NLQ Agent instance
 *
 * @example
 * ```typescript
 * const agent = createNlqAgent();
 * if (agent) {
 *   const result = await agent.run('서버 상태 알려줘');
 *   console.log(result.text);
 * }
 * ```
 */
export function createNlqAgent(): BaseAgent | null {
  return AgentFactory.create('nlq');
}
