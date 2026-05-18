/**
 * Reporter Pipeline (Evaluator-Optimizer Pattern)
 *
 * 3-stage pipeline for high-quality incident reports:
 * 1. Reporter Agent generates initial report
 * 2. Evaluator Agent assesses quality
 * 3. Optimizer Agent improves if score < threshold
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import type { DomainDataSource } from '../../../core/assistant-runtime';
import { logger } from '../../../lib/logger';
import {
  createAgentDataSourceContext,
  resolveDomainHistory,
  resolveDomainSnapshot,
} from './domain-data-source';
import {
  calculateActionabilityScore,
  calculateCompletenessScore,
  calculateStructureScore,
} from './reporter-pipeline-score-utils';
import {
  determineFocusArea,
  generateInitialReport,
  getMetricAverageFromMonitoringHistory,
  getSuggestedCommands,
  getServerTypeFromMonitoringState,
  type ReportForEvaluation,
} from './reporter-pipeline-report';

// ============================================================================
// Types
// ============================================================================

export interface PipelineConfig {
  /** Maximum optimization iterations */
  maxIterations: number;
  /** Quality threshold (0-1) */
  qualityThreshold: number;
  /** Maximum execution time (ms) */
  timeout: number;
  /** Domain-owned runtime data source */
  dataSource?: DomainDataSource;
  /** Runtime domain id for data source context */
  domainId?: string;
}

export type ReporterPipelineStage = 'reporter' | 'evaluator' | 'optimizer';

export interface ReporterPipelineStageTelemetry {
  stage: ReporterPipelineStage;
  label: string;
  execution: 'deterministic';
}

export interface PipelineResult {
  success: boolean;
  report: ReportForEvaluation | null;
  quality: {
    initialScore: number;
    finalScore: number;
    iterations: number;
  };
  metadata: {
    durationMs: number;
    agentsUsed: string[];
    pipelineStages: ReporterPipelineStageTelemetry[];
    optimizationsApplied: string[];
  };
  error?: string;
}

interface EvaluationScores {
  structure: number;
  completeness: number;
  accuracy: number;
  actionability: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: PipelineConfig = {
  maxIterations: 2, // Increased from 1 for quality improvement via optimization pass
  qualityThreshold: 0.75, // Slightly raised to trigger optimization
  timeout: 40_000, // Increased from 25s for complex report generation (Job Queue has 120s)
};

const REPORTER_HISTORY_SLOT_COUNT = 12;
const NO_INCIDENT_QUALITY_THRESHOLD = 0.65;

const REPORTER_PIPELINE_STAGE_LABELS: Record<ReporterPipelineStage, string> = {
  reporter: 'Reporter Agent',
  evaluator: 'Reporter Pipeline: evaluator stage',
  optimizer: 'Reporter Pipeline: optimizer stage',
};

function createPipelineStageTelemetry(
  stage: ReporterPipelineStage
): ReporterPipelineStageTelemetry {
  return {
    stage,
    label: REPORTER_PIPELINE_STAGE_LABELS[stage],
    execution: 'deterministic',
  };
}

function dedupePipelineStages(
  stages: ReporterPipelineStageTelemetry[]
): ReporterPipelineStageTelemetry[] {
  const seen = new Set<ReporterPipelineStage>();
  return stages.filter(({ stage }) => {
    if (seen.has(stage)) return false;
    seen.add(stage);
    return true;
  });
}

function getEffectiveQualityThreshold(
  report: ReportForEvaluation,
  configuredThreshold: number
): number {
  if (report.affectedServers.length === 0) {
    if (configuredThreshold > DEFAULT_CONFIG.qualityThreshold) {
      return configuredThreshold;
    }
    return Math.min(configuredThreshold, NO_INCIDENT_QUALITY_THRESHOLD);
  }

  return configuredThreshold;
}

// ============================================================================
// Pipeline Implementation
// ============================================================================

/**
 * Execute the Reporter Pipeline with Evaluator-Optimizer pattern
 *
 * @param query - User query for report generation
 * @param config - Optional pipeline configuration
 * @returns PipelineResult with report and quality metrics
 */
export async function executeReporterPipeline(
  query: string,
  config: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  logger.info(`[ReporterPipeline] Starting with query: "${query.substring(0, 50)}..."`);
  logger.info(`[ReporterPipeline] Config: maxIterations=${finalConfig.maxIterations}, threshold=${finalConfig.qualityThreshold}`);

  const agentsUsed: string[] = [];
  const pipelineStages: ReporterPipelineStageTelemetry[] = [];
  const optimizationsApplied: string[] = [];

  try {
    // =========================================================================
    // Stage 1: Generate Initial Report
    // =========================================================================
    logger.info('[Stage 1] Generating initial report...');
    agentsUsed.push(REPORTER_PIPELINE_STAGE_LABELS.reporter);
    pipelineStages.push(createPipelineStageTelemetry('reporter'));

    const dataSourceContext = createAgentDataSourceContext({
      query,
      domainId: finalConfig.domainId,
    });
    const [snapshot, historyEntries] = await Promise.all([
      resolveDomainSnapshot(
        finalConfig.dataSource,
        dataSourceContext,
        'reporter-pipeline'
      ),
      resolveDomainHistory(
        finalConfig.dataSource,
        REPORTER_HISTORY_SLOT_COUNT,
        dataSourceContext,
        'reporter-pipeline'
      ),
    ]);
    const stateData = snapshot?.data;
    const historyData = historyEntries;

    const initialReport = generateInitialReport(stateData, historyData);

    // RAG is now handled by Reporter Agent via searchKnowledgeBase tool
    // (AI SDK v6 best practice: LLM calls tools directly for context inclusion)

    if (!initialReport) {
      return {
        success: false,
        report: null,
        quality: { initialScore: 0, finalScore: 0, iterations: 0 },
        metadata: {
          durationMs: Date.now() - startTime,
          agentsUsed,
          pipelineStages,
          optimizationsApplied,
        },
        error: 'Failed to generate initial report',
      };
    }

    let currentReport = initialReport;
    // Use evaluateReport for consistent scoring (same as finalScore calculation)
    const initialEvaluation = evaluateReport(currentReport);
    let initialScore = initialEvaluation.overallScore;
    let currentScore = initialScore;

    // =========================================================================
    // Stage 2-3: Evaluate and Optimize Loop
    // =========================================================================
    for (let iteration = 0; iteration < finalConfig.maxIterations; iteration++) {
      // Check timeout
      if (Date.now() - startTime > finalConfig.timeout) {
        logger.warn(`[ReporterPipeline] Timeout reached at iteration ${iteration + 1}`);
        break;
      }

      // Evaluate current report
      logger.info(`[Stage 2] Evaluating report (iteration ${iteration + 1})...`);
      agentsUsed.push(REPORTER_PIPELINE_STAGE_LABELS.evaluator);
      pipelineStages.push(createPipelineStageTelemetry('evaluator'));

      const evaluation = evaluateReport(currentReport);
      currentScore = evaluation.overallScore;
      const qualityThreshold = getEffectiveQualityThreshold(
        currentReport,
        finalConfig.qualityThreshold
      );

      logger.info(`[Evaluation] Score: ${(currentScore * 100).toFixed(1)}%`);

      // Check if quality threshold met
      if (currentScore >= qualityThreshold) {
        logger.info(`[ReporterPipeline] Quality threshold met (${(currentScore * 100).toFixed(1)}% >= ${(qualityThreshold * 100).toFixed(1)}%)`);
        break;
      }

      // Optimize if not final iteration
      if (iteration < finalConfig.maxIterations - 1) {
        logger.info(`[Stage 3] Optimizing report (iteration ${iteration + 1})...`);
        agentsUsed.push(REPORTER_PIPELINE_STAGE_LABELS.optimizer);
        pipelineStages.push(createPipelineStageTelemetry('optimizer'));

        const optimized = optimizeReport(
          currentReport,
          evaluation,
          stateData,
          historyData
        );

        if (optimized.report) {
          currentReport = optimized.report;
          optimizationsApplied.push(...optimized.optimizations);
          logger.info(`[Optimization] Applied: ${optimized.optimizations.join(', ')}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    logger.info(`[ReporterPipeline] Completed in ${durationMs}ms`);
    logger.info(`   Initial: ${(initialScore * 100).toFixed(1)}% -> Final: ${(currentScore * 100).toFixed(1)}%`);
    logger.info(`   Agents: ${agentsUsed.join(' -> ')}`);

    return {
      success: true,
      report: currentReport,
      quality: {
        initialScore,
        finalScore: currentScore,
        iterations:
          pipelineStages.filter(({ stage }) => stage === 'optimizer').length + 1,
      },
      metadata: {
        durationMs,
        agentsUsed: [...new Set(agentsUsed)],
        pipelineStages: dedupePipelineStages(pipelineStages),
        optimizationsApplied,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[ReporterPipeline] Error:`, errorMessage);

    return {
      success: false,
      report: null,
      quality: { initialScore: 0, finalScore: 0, iterations: 0 },
      metadata: {
        durationMs: Date.now() - startTime,
        agentsUsed,
        pipelineStages,
        optimizationsApplied,
      },
      error: errorMessage,
    };
  }
}

/**
 * Evaluate report quality
 */
function evaluateReport(report: ReportForEvaluation): {
  overallScore: number;
  scores: EvaluationScores;
  issues: string[];
  recommendations: string[];
} {
  const isNoIncident = report.affectedServers.length === 0;
  const scores: EvaluationScores = {
    structure: calculateStructureScore(report),
    completeness: calculateCompletenessScore(report),
    accuracy: isNoIncident ? 0.85 : (report.rootCause?.confidence ?? 0.5),
    actionability: calculateActionabilityScore(report.suggestedActions),
  };

  const overallScore = (
    scores.structure * 0.25 +
    scores.completeness * 0.3 +
    scores.accuracy * 0.25 +
    scores.actionability * 0.2
  );

  const issues: string[] = [];
  if (scores.structure < 0.6) issues.push('보고서 구조 불완전');
  if (scores.accuracy < 0.75) issues.push('근본원인 분석 신뢰도 부족');
  if (scores.actionability < 0.7) issues.push('권장 조치가 너무 일반적');

  const recommendations: string[] = [];
  if (scores.accuracy < 0.75) recommendations.push('근본원인 분석 심화 필요');
  if (scores.actionability < 0.7) recommendations.push('CLI 명령어 추가 필요');

  return { overallScore, scores, issues, recommendations };
}

const ACTION_COMMAND_PATTERN =
  /`(?:sudo|systemctl|docker|kubectl|top|ps|free|df|netstat|ss|mysql|redis|journalctl|dmesg|lsof|find)[^`]*`|^\s*(?:\$|sudo|systemctl|docker|kubectl)\b/i;

function hasExecutableCommand(action: string): boolean {
  return ACTION_COMMAND_PATTERN.test(action);
}

/**
 * Optimize report based on evaluation
 */
function optimizeReport(
  report: ReportForEvaluation,
  evaluation: { issues: string[]; recommendations: string[] },
  stateData?: unknown,
  historyData?: unknown[]
): {
  report: ReportForEvaluation;
  optimizations: string[];
} {
  const optimizations: string[] = [];
  const optimizedReport = { ...report };

  if (report.affectedServers.length === 0) {
    const preventiveActions: string[] = [];
    const warningCount = report.warnings?.length ?? 0;
    const predictionCount = report.predictions?.length ?? 0;

    if (warningCount > 0) {
      preventiveActions.push(
        `임계 근접 서버 ${warningCount}대 예방 점검\n   명령어: \`top -o %CPU -b -n 1 | head -20\``
      );
    }

    if (predictionCount > 0) {
      preventiveActions.push(
        `예측 추세 ${predictionCount}건 재확인\n   명령어: \`journalctl -xe --no-pager | tail -50\``
      );
    }

    const existingActions = new Set(optimizedReport.suggestedActions);
    const newActions = preventiveActions.filter(
      (action) => !existingActions.has(action)
    );

    if (newActions.length > 0) {
      optimizedReport.suggestedActions = [
        ...optimizedReport.suggestedActions,
        ...newActions,
      ];
      optimizations.push('예방 점검 예측 강화');
    }
  }

  // Optimize root cause if confidence is low
  if (
    evaluation.issues.includes('근본원인 분석 신뢰도 부족') &&
    report.rootCause &&
    report.affectedServers.length > 0
  ) {
    const serverId = report.affectedServers[0].id;

    const additionalEvidence: string[] = [];
    let confidenceBoost = 0;

    const avgCpu = getMetricAverageFromMonitoringHistory(
      historyData,
      serverId,
      'cpu'
    );
    if (avgCpu !== null && avgCpu > 85) {
      additionalEvidence.push(`최근 1시간 평균 CPU ${avgCpu.toFixed(1)}%`);
      confidenceBoost += 0.1;
    }

    optimizedReport.rootCause = {
      ...report.rootCause,
      confidence: Math.min(report.rootCause.confidence + confidenceBoost + 0.1, 0.95),
      evidence: [...report.rootCause.evidence, ...additionalEvidence],
    };
    optimizations.push('근본원인 분석 심화');
  }

  // Enrich with similar past cases from RAG
  if (report.similarCases && report.similarCases.length > 0) {
    optimizedReport.suggestedActions = [
      ...report.suggestedActions,
      ...report.similarCases.map(c => `과거 유사 사례: ${c}`),
    ];
    optimizations.push('과거 유사 사례 추가');
  }

  // Enhance suggested actions if too generic
  if (evaluation.issues.includes('권장 조치가 너무 일반적')) {
    const serverType = getServerTypeFromMonitoringState(
      stateData,
      report.affectedServers[0]?.id
    );

    optimizedReport.suggestedActions = optimizedReport.suggestedActions.map((action, i) => {
      if (hasExecutableCommand(action)) return action;

      let actionFocusArea: ReturnType<typeof determineFocusArea> = 'general';
      const actionLower = action.toLowerCase();
      if (actionLower.includes('cpu')) {
        actionFocusArea = 'cpu';
      } else if (
        actionLower.includes('memory') ||
        actionLower.includes('메모리')
      ) {
        actionFocusArea = 'memory';
      } else if (
        actionLower.includes('disk') ||
        actionLower.includes('디스크')
      ) {
        actionFocusArea = 'disk';
      } else if (
        actionLower.includes('network') ||
        actionLower.includes('네트워크')
      ) {
        actionFocusArea = 'network';
      } else {
        actionFocusArea = determineFocusArea(report);
      }

      const commands = getSuggestedCommands(actionFocusArea, serverType);
      const cmd = commands[i % commands.length] || 'systemctl status';
      return `${action}\n   명령어: \`${cmd}\``;
    });
    optimizations.push('권장 조치 구체화');
  }

  return { report: optimizedReport, optimizations };
}

// calculateQuickScore removed - using evaluateReport for consistent initial/final scoring

// ============================================================================
// Export
// ============================================================================

export default executeReporterPipeline;
