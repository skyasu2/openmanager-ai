/**
 * Analyst Agent
 *
 * Specializes in anomaly detection, trend prediction, and pattern analysis.
 * Provides deep insights into system behavior.
 *
 * Model: Cerebras Qwen primary / Groq llama-4-scout fallback / Mistral
 *
 * @version 4.0.0 - Migrated to BaseAgent pattern
 * @created 2025-12-01
 * @updated 2026-01-27 - BaseAgent/AgentFactory migration
 */

import { AgentFactory, type BaseAgent } from './agent-factory';

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
