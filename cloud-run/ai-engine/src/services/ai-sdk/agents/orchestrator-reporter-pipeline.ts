import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { logger } from '../../../lib/logger';
import { createSupervisorTrace } from '../../observability/langfuse';

import type { MultiAgentResponse } from './orchestrator-types';
import { executeReporterPipeline } from './reporter-pipeline';
import { evaluateAgentResponseQuality } from './response-quality';

export async function executeReporterWithPipeline(
  query: string,
  startTime: number
): Promise<MultiAgentResponse | null> {
  logger.info(
    `[ReporterPipeline] Starting pipeline for query: "${query.substring(0, 50)}..."`
  );

  try {
    const pipelineResult = await executeReporterPipeline(query, {
      qualityThreshold: 0.75,
      maxIterations: 2,
      timeout: 45_000,
    });

    if (!pipelineResult.success || !pipelineResult.report) {
      logger.warn(
        `⚠️ [ReporterPipeline] Pipeline failed: ${pipelineResult.error || 'No report generated'}`
      );
      return null;
    }

    const durationMs = Date.now() - startTime;

    let responseText = pipelineResult.report.markdown ?? '';

    if (!responseText) {
      responseText = `# ${pipelineResult.report.title}\n\n`;
      responseText += `## 요약\n${pipelineResult.report.summary}\n\n`;

      if (pipelineResult.report.affectedServers.length > 0) {
        responseText += `## 영향받은 서버 (${pipelineResult.report.affectedServers.length}대)\n`;
        for (const server of pipelineResult.report.affectedServers) {
          responseText += `- **${server.name}** (${server.status}): ${server.primaryIssue}\n`;
        }
        responseText += '\n';
      }

      if (pipelineResult.report.warnings?.length) {
        responseText += `## 임계 근접 경고\n`;
        for (const warning of pipelineResult.report.warnings) {
          responseText += `- **${warning.serverName}**: ${warning.metric.toUpperCase()} ${warning.currentValue.toFixed(1)}% (임계값 ${warning.threshold}%까지 ${warning.gap}%)\n`;
        }
        responseText += '\n';
      }

      if (pipelineResult.report.rootCause) {
        responseText += `## 근본 원인 분석\n`;
        responseText += `- **원인**: ${pipelineResult.report.rootCause.cause}\n`;
        responseText += `- **신뢰도**: ${(pipelineResult.report.rootCause.confidence * 100).toFixed(0)}%\n`;
        responseText += `- **제안**: ${pipelineResult.report.rootCause.suggestedFix}\n\n`;
      }

      if (pipelineResult.report.suggestedActions.length > 0) {
        responseText += `## 권장 조치\n`;
        for (const action of pipelineResult.report.suggestedActions) {
          responseText += `- ${action}\n`;
        }
        responseText += '\n';
      }

      if (pipelineResult.report.predictions?.length) {
        responseText += `## 예측 분석\n`;
        for (const prediction of pipelineResult.report.predictions) {
          const arrow =
            prediction.trend === 'increasing'
              ? '↑'
              : prediction.trend === 'decreasing'
                ? '↓'
                : '→';
          responseText += `- **${prediction.serverName}** ${prediction.metric.toUpperCase()}: ${prediction.currentValue}% ${arrow} ${prediction.predictedValue}% (1시간 후, 신뢰도 ${(prediction.confidence * 100).toFixed(0)}%)`;
          if (prediction.thresholdBreachHumanReadable) {
            responseText += ` — ${prediction.thresholdBreachHumanReadable}`;
          }
          responseText += '\n';
        }
      }
    }

    const sanitizedResponse = sanitizeChineseCharacters(responseText);
    const quality = evaluateAgentResponseQuality(
      'Reporter Agent',
      sanitizedResponse,
      {
        durationMs,
      }
    );

    try {
      const trace = createSupervisorTrace({
        sessionId: `reporter-pipeline-${Date.now()}`,
        mode: 'multi',
        query,
      });
      trace.score({
        name: 'report-initial-score',
        value: pipelineResult.quality.initialScore,
      });
      trace.score({
        name: 'report-final-score',
        value: pipelineResult.quality.finalScore,
      });
      trace.score({
        name: 'report-correction-rate',
        value:
          pipelineResult.quality.finalScore -
          pipelineResult.quality.initialScore,
      });
    } catch (error) {
      logger.warn(
        `⚠️ [ReporterPipeline] Langfuse score recording failed (non-blocking):`,
        error instanceof Error ? error.message : String(error)
      );
    }

    logger.info(
      `[ReporterPipeline] Completed in ${durationMs}ms, ` +
        `Quality: ${(pipelineResult.quality.initialScore * 100).toFixed(0)}% → ${(pipelineResult.quality.finalScore * 100).toFixed(0)}%, ` +
        `Iterations: ${pipelineResult.quality.iterations}`
    );

    return {
      success: true,
      response: sanitizedResponse,
      handoffs: [
        {
          from: 'Orchestrator',
          to: 'Reporter Agent',
          reason: `Pipeline execution (quality: ${(pipelineResult.quality.finalScore * 100).toFixed(0)}%)`,
        },
      ],
      finalAgent: 'Reporter Agent',
      toolsCalled: ['executeReporterPipeline'],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'pipeline',
        modelId: 'reporter-pipeline',
        totalRounds: pipelineResult.quality.iterations,
        handoffCount: 1,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        qualityScore: pipelineResult.quality.finalScore,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [ReporterPipeline] Error: ${errorMessage}`);
    return null;
  }
}
