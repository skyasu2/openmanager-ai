/**
 * Final Answer Tool
 *
 * AI SDK v6 Best Practice: Use hasToolCall('finalAnswer') to terminate tool loops
 * gracefully instead of relying solely on stepCountIs(N).
 *
 * This tool allows agents to explicitly signal when they have completed analysis
 * and are ready to provide a final response.
 *
 * @version 1.0.0
 * @created 2026-01-24
 */

import { z } from 'zod';
import { tool } from 'ai';

/**
 * Final answer result type
 */
export interface FinalAnswerResult {
  answer: string;
  confidence: number;
  toolsUsed: string[];
  timestamp: string;
}

/**
 * Final Answer Tool
 *
 * Agents should call this tool when analysis is complete to:
 * 1. Signal loop termination via hasToolCall('finalAnswer')
 * 2. Provide structured response metadata
 * 3. Track confidence and tool usage
 */
export const finalAnswer = tool({
  description:
    '최종 응답을 제출합니다. 분석이 완료되면 반드시 이 도구를 호출하세요. 이 도구를 호출하면 도구 루프가 종료됩니다.',
  inputSchema: z.object({
    answer: z.string().describe('사용자에게 전달할 최종 응답 (마크다운 형식 지원)'),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('응답 신뢰도 (0-1, 기본값: 0.8)'),
    toolsUsed: z
      .array(z.string())
      .optional()
      .describe('분석에 사용된 도구 목록 (자동 추적용)'),
  }),
  execute: async ({
    answer,
    confidence,
    toolsUsed,
  }: {
    answer: string;
    confidence?: number;
    toolsUsed?: string[];
  }): Promise<FinalAnswerResult> => ({
    answer,
    confidence: confidence ?? 0.8,
    toolsUsed: toolsUsed ?? [],
    timestamp: new Date().toISOString(),
  }),
});
