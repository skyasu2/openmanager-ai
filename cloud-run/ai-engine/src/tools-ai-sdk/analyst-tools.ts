/**
 * Analyst Tools (AI SDK Format) — Barrel + Pattern Analysis
 *
 * Re-exports all analyst tools from sub-modules.
 * Contains analyzePattern (lightweight query intent classifier).
 *
 * Sub-modules:
 * - analyst-tools-detect.ts    — detectAnomalies (single server)
 * - analyst-tools-detect-all.ts — detectAnomaliesAllServers (all servers + forecast)
 * - analyst-tools-trend.ts     — predictTrends
 * - analyst-tools-shared.ts    — shared utilities & types
 *
 * @version 1.1.0
 */

import { tool } from 'ai';
import { z } from 'zod';

import { PATTERN_INSIGHTS } from './analyst-tools-shared';

// Re-exports
export { detectAnomalies } from './analyst-tools-detect';
export { detectAnomaliesAllServers } from './analyst-tools-detect-all';
export { predictTrends } from './analyst-tools-trend';

// ============================================================================
// Pattern Analysis Tool
// ============================================================================

const PATTERN_CONFIDENCE: Record<string, number> = {
  system_performance: 0.9,
  memory_status: 0.88,
  storage_info: 0.86,
  server_status: 0.84,
  trend_analysis: 0.9,
  anomaly_detection: 0.92,
};

/**
 * Analyze Pattern Tool
 * Classifies user query intent
 */
export const analyzePattern = tool({
  description:
    '사용자 질문의 패턴을 분석하여 의도를 파악하고 관련 인사이트를 제공합니다.',
  inputSchema: z.object({
    query: z.string().describe('분석할 사용자 질문'),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      const patterns: string[] = [];
      const q = query.toLowerCase();

      // Pattern matching
      if (/cpu|프로세서|성능/i.test(q)) patterns.push('system_performance');
      if (/메모리|ram|memory/i.test(q)) patterns.push('memory_status');
      if (/디스크|저장소|용량/i.test(q)) patterns.push('storage_info');
      if (/서버|시스템|상태/i.test(q)) patterns.push('server_status');
      if (/트렌드|추세|예측/i.test(q)) patterns.push('trend_analysis');
      if (/이상|anomaly|alert/i.test(q)) patterns.push('anomaly_detection');

      if (patterns.length === 0) {
        return {
          success: false,
          message: '매칭되는 패턴 없음',
          query,
          systemMessage: 'TOOL_EXECUTION_FAILED: 사용자 질문에서 분석 가능한 이상/메트릭 관련 패턴을 찾지 못했습니다.',
          suggestedAgentAction: '특정 시스템 문제가 아닌 일반적 질문일 수 있으므로, 사용자의 질문 의도를 직접 추론하여 자연스러운 대화로 응답하세요.',
        };
      }

      const analysisResults = patterns.map((pattern) => ({
        pattern,
        confidence: PATTERN_CONFIDENCE[pattern] ?? 0.8,
        insights: PATTERN_INSIGHTS[pattern] || '일반 분석 수행',
      }));

      return {
        success: true,
        patterns,
        detectedIntent: patterns[0],
        analysisResults,
        summary: `${patterns.length}개 패턴 감지: ${patterns.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        systemMessage: `TOOL_EXECUTION_FAILED: 패턴 분석 실행 중 오류발생. (${String(error)})`,
        suggestedAgentAction: '패턴 분석 도구 오류가 발생했으나 당황하지 말고, 사용자의 질문 컨텍스트를 문장 그대로 해석하여 본인의 지식으로 적절히 대응하세요.',
      };
    }
  },
});
