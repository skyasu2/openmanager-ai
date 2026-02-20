import { tool } from 'ai';
import { z } from 'zod';
import type { LogAnalysisResult, LogType } from './vision-types';

export const analyzeLargeLog = tool({
  description: `대용량 로그 파일을 분석합니다. Gemini의 1M 토큰 컨텍스트를 활용하여 전체 로그를 분석하고 에러 패턴, 타임라인, 근본 원인을 추론합니다.

두 가지 모드:
1. **전처리 모드**: logContent 제공 시 → 기본 통계 + 에러 클러스터링
2. **구조화 모드**: analysisResult 제공 시 → LLM 분석 결과 구조화`,

  inputSchema: z.object({
    logContent: z
      .string()
      .optional()
      .describe('분석할 로그 텍스트 (전처리 모드)'),
    logType: z
      .enum(['syslog', 'application', 'access', 'error', 'security', 'custom'])
      .optional()
      .default('application')
      .describe('로그 유형'),
    timeRange: z.string().optional().describe('분석 시간 범위'),
    focusPattern: z.string().optional().describe('집중 분석할 패턴'),
    analysisResult: z
      .object({
        topErrors: z
          .array(
            z.object({
              message: z.string(),
              count: z.number(),
              firstSeen: z.string().optional(),
              lastSeen: z.string().optional(),
            }),
          )
          .optional(),
        patterns: z
          .array(
            z.object({
              pattern: z.string(),
              frequency: z.number(),
              severity: z.string(),
            }),
          )
          .optional(),
        timeline: z
          .array(
            z.object({
              timestamp: z.string(),
              event: z.string(),
              severity: z.string(),
            }),
          )
          .optional(),
        rootCauseHypothesis: z.string().optional(),
        recommendations: z.array(z.string()).optional(),
        summary: z.string(),
      })
      .optional()
      .describe('LLM 분석 결과 (구조화 모드)'),
  }),

  execute: async ({
    logContent,
    logType,
    timeRange,
    focusPattern,
    analysisResult,
  }: {
    logContent?: string;
    logType?: LogType;
    timeRange?: string;
    focusPattern?: string;
    analysisResult?: {
      topErrors?: {
        message: string;
        count: number;
        firstSeen?: string;
        lastSeen?: string;
      }[];
      patterns?: { pattern: string; frequency: number; severity: string }[];
      timeline?: { timestamp: string; event: string; severity: string }[];
      rootCauseHypothesis?: string;
      recommendations?: string[];
      summary: string;
    };
  }) => {
    const actualLogType = logType || 'application';

    if (analysisResult) {
      const mappedTopErrors = (analysisResult.topErrors || []).map((e) => ({
        message: e.message,
        count: e.count,
        firstSeen: e.firstSeen || 'N/A',
        lastSeen: e.lastSeen || 'N/A',
      }));

      const result: LogAnalysisResult = {
        success: true,
        logType: actualLogType,
        totalLines: 0,
        analyzedLines: 0,
        findings: {
          errorCount:
            analysisResult.topErrors?.reduce((sum, e) => sum + e.count, 0) || 0,
          warnCount: 0,
          topErrors: mappedTopErrors,
          patterns: analysisResult.patterns || [],
          timeline: analysisResult.timeline || [],
        },
        rootCauseHypothesis: analysisResult.rootCauseHypothesis,
        recommendations: analysisResult.recommendations || [],
        summary: analysisResult.summary,
      };

      return {
        ...result,
        mode: 'structuring',
        analysisComplete: true,
      };
    }

    if (!logContent || logContent.trim().length === 0) {
      return {
        success: false,
        error: 'logContent 또는 analysisResult 중 하나가 필요합니다.',
        logType: actualLogType,
        totalLines: 0,
        analyzedLines: 0,
        findings: {
          errorCount: 0,
          warnCount: 0,
          topErrors: [],
          patterns: [],
          timeline: [],
        },
        recommendations: [],
        summary: '분석 실패: 입력 데이터 없음',
      };
    }

    const lines = logContent.split('\n');
    const totalLines = lines.length;

    const errorLines = lines.filter((l: string) =>
      /error|exception|fatal|critical/i.test(l),
    );
    const warnLines = lines.filter((l: string) => /warn|warning/i.test(l));

    const errorCounts = new Map<string, number>();
    for (const line of errorLines.slice(0, 1000)) {
      const normalized = line
        .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
        .replace(/\d+\.\d+\.\d+\.\d+/g, '[IP]')
        .replace(/[a-f0-9]{8,}/gi, '[HEX]')
        .substring(0, 200);

      errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
    }

    const sortedErrors = [...errorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const result: LogAnalysisResult = {
      success: true,
      logType: actualLogType,
      totalLines,
      analyzedLines: totalLines,
      findings: {
        errorCount: errorLines.length,
        warnCount: warnLines.length,
        topErrors: sortedErrors.map(([message, count]) => ({
          message,
          count,
          firstSeen: 'N/A',
          lastSeen: 'N/A',
        })),
        patterns: [],
        timeline: [],
      },
      recommendations: [],
      summary: `${actualLogType} 로그 전처리 완료: ${totalLines}줄, ERROR: ${errorLines.length}건, WARN: ${warnLines.length}건`,
    };

    return {
      ...result,
      mode: 'preprocessing',
      focusPattern,
      timeRange,
      analysisHints: {
        highErrorCount: errorLines.length > 100,
        commonPatterns: sortedErrors.slice(0, 3).map(([msg]) => msg),
        suggestedFocus: focusPattern || (errorLines.length > 0 ? 'ERROR' : 'WARN'),
      },
    };
  },
});
