import { tool } from 'ai';
import { z } from 'zod';
import {
  calculateActionabilityScore,
  calculateCompletenessScore,
  calculateStructureScore,
  generateRecommendations,
  identifyIssues,
  QUALITY_THRESHOLD,
} from './incident-evaluation-helpers';
import type {
  EvaluationResult,
  EvaluationScores,
} from './incident-evaluation-types';

export const evaluateIncidentReport = tool({
  description:
    '장애 보고서의 품질을 종합 평가합니다. 구조 완성도, 내용 완성도, 분석 정확도, 조치 실행가능성을 점수화합니다.',
  inputSchema: z.object({
    report: z
      .object({
        title: z.string().optional(),
        summary: z.string().optional(),
        affectedServers: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              status: z.string(),
              primaryIssue: z.string(),
            }),
          )
          .optional(),
        timeline: z
          .array(
            z.object({
              timestamp: z.string(),
              eventType: z.string(),
              severity: z.enum(['info', 'warning', 'critical']),
              description: z.string(),
            }),
          )
          .optional(),
        rootCause: z
          .object({
            cause: z.string(),
            confidence: z.number(),
            evidence: z.array(z.string()),
            suggestedFix: z.string(),
          })
          .nullable()
          .optional(),
        suggestedActions: z.array(z.string()).optional(),
        sla: z
          .object({
            targetUptime: z.number(),
            actualUptime: z.number(),
            slaViolation: z.boolean(),
          })
          .optional(),
      })
      .describe('평가할 장애 보고서'),
  }),
  execute: async ({ report }) => {
    console.log('📊 [Evaluator] Evaluating incident report quality');

    const scores: EvaluationScores = {
      structure: calculateStructureScore(report),
      completeness: calculateCompletenessScore(report),
      accuracy: report.rootCause?.confidence ?? 0.5,
      actionability: calculateActionabilityScore(report.suggestedActions || []),
    };

    const overallScore =
      scores.structure * 0.2 +
      scores.completeness * 0.25 +
      scores.accuracy * 0.35 +
      scores.actionability * 0.2;

    const issues = identifyIssues(report, scores);
    const recommendations = generateRecommendations(scores);

    const result: EvaluationResult = {
      scores,
      overallScore,
      needsOptimization: overallScore < QUALITY_THRESHOLD,
      issues,
      recommendations,
    };

    console.log(
      `📊 [Evaluator] Score: ${(overallScore * 100).toFixed(1)}%, needs optimization: ${result.needsOptimization}`,
    );

    return {
      success: true,
      evaluation: result,
      summary: result.needsOptimization
        ? `⚠️ 품질 점수 ${(overallScore * 100).toFixed(1)}% - 최적화 필요 (임계값: ${QUALITY_THRESHOLD * 100}%)`
        : `✅ 품질 점수 ${(overallScore * 100).toFixed(1)}% - 기준 충족`,
      timestamp: new Date().toISOString(),
    };
  },
});

export const validateReportStructure = tool({
  description:
    '보고서의 구조적 완성도를 검증합니다. 필수 필드 존재 여부, 데이터 형식, 값의 유효성을 확인합니다.',
  inputSchema: z.object({
    report: z
      .object({
        title: z.string().optional(),
        summary: z.string().optional(),
        affectedServers: z.array(z.any()).optional(),
        timeline: z.array(z.any()).optional(),
        rootCause: z.any().optional(),
        suggestedActions: z.array(z.string()).optional(),
      })
      .describe('검증할 보고서'),
  }),
  execute: async ({ report }) => {
    console.log('🔍 [Validator] Validating report structure');

    const validationResults: Array<{
      field: string;
      valid: boolean;
      message: string;
    }> = [];

    validationResults.push({
      field: 'title',
      valid: typeof report.title === 'string' && report.title.length >= 5,
      message: report.title
        ? '제목이 유효합니다'
        : '제목이 누락되었거나 너무 짧습니다',
    });

    const summaryLength = report.summary?.length ?? 0;
    validationResults.push({
      field: 'summary',
      valid: typeof report.summary === 'string' && summaryLength >= 20,
      message: summaryLength >= 20 ? '요약이 유효합니다' : '요약이 너무 짧습니다',
    });

    validationResults.push({
      field: 'affectedServers',
      valid:
        Array.isArray(report.affectedServers) &&
        report.affectedServers.length > 0,
      message: report.affectedServers?.length
        ? `${report.affectedServers.length}대 서버 정보 포함`
        : '영향받은 서버 정보 없음',
    });

    const timelineLength = report.timeline?.length ?? 0;
    validationResults.push({
      field: 'timeline',
      valid: Array.isArray(report.timeline) && timelineLength >= 3,
      message:
        timelineLength >= 3
          ? `${timelineLength}개 타임라인 이벤트`
          : '타임라인이 부족합니다 (최소 3개)',
    });

    const hasValidRootCause =
      report.rootCause &&
      typeof report.rootCause.cause === 'string' &&
      typeof report.rootCause.confidence === 'number';
    validationResults.push({
      field: 'rootCause',
      valid: hasValidRootCause,
      message: hasValidRootCause
        ? '근본원인 분석 포함'
        : '근본원인 분석이 없거나 불완전합니다',
    });

    const actionsLength = report.suggestedActions?.length ?? 0;
    validationResults.push({
      field: 'suggestedActions',
      valid: Array.isArray(report.suggestedActions) && actionsLength >= 2,
      message:
        actionsLength >= 2
          ? `${actionsLength}개 권장 조치`
          : '권장 조치가 부족합니다',
    });

    const passedCount = validationResults.filter((r) => r.valid).length;
    const totalCount = validationResults.length;
    const passRate = passedCount / totalCount;

    return {
      success: true,
      validationResults,
      passedCount,
      totalCount,
      passRate,
      summary:
        passRate >= 0.8
          ? `✅ 구조 검증 통과 (${passedCount}/${totalCount})`
          : `⚠️ 구조 검증 실패 (${passedCount}/${totalCount})`,
      timestamp: new Date().toISOString(),
    };
  },
});

export const scoreRootCauseConfidence = tool({
  description:
    '근본원인 분석의 신뢰도를 상세 점수화합니다. 증거 품질, 인과관계 명확성, 재현가능성을 평가합니다.',
  inputSchema: z.object({
    rootCause: z
      .object({
        cause: z.string(),
        confidence: z.number(),
        evidence: z.array(z.string()),
        suggestedFix: z.string(),
      })
      .describe('평가할 근본원인 분석'),
    affectedServersCount: z.number().default(1).describe('영향받은 서버 수'),
    timelineEventsCount: z.number().default(0).describe('타임라인 이벤트 수'),
  }),
  execute: async ({ rootCause, affectedServersCount, timelineEventsCount }) => {
    console.log('📈 [RCA Scorer] Scoring root cause confidence');

    const evidenceScore = Math.min(rootCause.evidence.length / 5, 1) * 0.4;

    const hasSpecificMetric =
      /CPU|Memory|Disk|Network|메모리|디스크/i.test(rootCause.cause);
    const hasServerName = /server|srv|서버/i.test(rootCause.cause);
    const specificityScore =
      (hasSpecificMetric ? 0.3 : 0) + (hasServerName ? 0.2 : 0);

    const correlationScore =
      affectedServersCount > 1
        ? Math.min(timelineEventsCount / (affectedServersCount * 2), 1) * 0.3
        : 0.2;

    const hasActionableFix =
      /확인|점검|재시작|증설|정리/i.test(rootCause.suggestedFix);
    const fixScore = hasActionableFix ? 0.1 : 0.05;

    const calculatedConfidence =
      evidenceScore + specificityScore + correlationScore + fixScore;
    const finalConfidence = Math.min(Math.max(calculatedConfidence, 0.3), 0.95);

    return {
      success: true,
      originalConfidence: rootCause.confidence,
      calculatedConfidence: finalConfidence,
      breakdown: {
        evidenceQuality: evidenceScore,
        causeSpecificity: specificityScore,
        correlationStrength: correlationScore,
        fixActionability: fixScore,
      },
      recommendation:
        finalConfidence < 0.75
          ? 'refineRootCauseAnalysis 도구로 추가 분석 필요'
          : '신뢰도 충분',
      timestamp: new Date().toISOString(),
    };
  },
});
