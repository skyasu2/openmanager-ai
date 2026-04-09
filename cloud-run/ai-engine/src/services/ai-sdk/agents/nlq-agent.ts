/**
 * NLQ (Natural Language Query) Agent
 *
 * Handles all server data queries - from simple to complex:
 * - Simple: "서버 상태 요약", "CPU 높은 서버"
 * - Complex: "CPU > 80% AND 메모리 > 70%", "지난 1시간 에러 TOP 5"
 *
 * Model: Groq configurable default (currently meta-llama/llama-4-scout-17b-16e-instruct)
 * Fallback: Cerebras qwen-3-235b-a22b-instruct-2507 → Mistral
 *
 * @version 4.0.0 - Migrated to BaseAgent pattern
 * @created 2025-12-01
 * @updated 2026-01-27 - BaseAgent/AgentFactory migration
 */

import { AgentFactory, type BaseAgent } from './agent-factory';

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
