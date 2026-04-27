/**
 * Reporter Agent
 *
 * Specializes in generating incident reports and timelines.
 * Creates structured documentation for incidents and events.
 *
 * Model: Cerebras Qwen/llama3.1-8b primary / Groq llama-4-scout fallback / Mistral
 *
 * Usage:
 * - createReporterAgent(): Create agent for direct use
 * - generateHighQualityReport(): Pipeline with Evaluator-Optimizer (thorough)
 *
 * @version 4.0.0 - Migrated to BaseAgent pattern
 * @created 2025-12-01
 * @updated 2026-01-27 - BaseAgent/AgentFactory migration
 */

import { AgentFactory, type BaseAgent } from './agent-factory';
import { executeReporterPipeline, type PipelineConfig, type PipelineResult } from './reporter-pipeline';
import { logger } from '../../../lib/logger';

/**
 * Create a new Reporter Agent instance
 *
 * @example
 * ```typescript
 * const agent = createReporterAgent();
 * if (agent) {
 *   const result = await agent.run('장애 보고서 만들어줘');
 *   console.log(result.text);
 * }
 * ```
 */
export function createReporterAgent(): BaseAgent | null {
  return AgentFactory.create('reporter');
}

/**
 * Generate a high-quality incident report using the Evaluator-Optimizer pipeline.
 *
 * This function uses a 3-stage pipeline:
 * 1. Reporter Agent generates initial report
 * 2. Evaluator Agent assesses quality (structure, completeness, accuracy)
 * 3. Optimizer Agent improves if score < threshold (default 0.75)
 *
 * Use this when report quality is critical (e.g., customer-facing, post-mortems).
 * For quick internal reports, use the direct reporterAgent instead.
 *
 * @param query - The incident query or description
 * @param options - Pipeline configuration options
 * @returns PipelineResult with optimized report and quality metrics
 *
 * @example
 * ```typescript
 * const result = await generateHighQualityReport(
 *   'web-server-01 장애 보고서 생성',
 *   { qualityThreshold: 0.8, maxIterations: 3 }
 * );
 *
 * if (result.success) {
 *   console.log(`Quality: ${result.quality.finalScore * 100}%`);
 *   console.log(result.report);
 * }
 * ```
 */
export async function generateHighQualityReport(
  query: string,
  options: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  logger.info(`[Reporter] Generating high-quality report with pipeline...`);
  return executeReporterPipeline(query, options);
}
