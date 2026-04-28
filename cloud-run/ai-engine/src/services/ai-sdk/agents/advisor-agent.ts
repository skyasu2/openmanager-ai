/**
 * Advisor Agent
 *
 * Specializes in troubleshooting guidance and command recommendations.
 * Uses Knowledge Retrieval Lite (BM25 + pgVector) to search past incidents and best practices.
 *
 * Model chain: Cerebras Qwen primary -> Groq llama-4-scout -> Mistral last-resort.
 * Retrieval: Knowledge Retrieval Lite only; text fallback providers stay outside retrieval.
 *
 * @version 4.0.0 - Migrated to BaseAgent pattern
 * @created 2025-12-01
 * @updated 2026-01-27 - BaseAgent/AgentFactory migration
 */

import { AgentFactory, type BaseAgent } from './agent-factory';

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
