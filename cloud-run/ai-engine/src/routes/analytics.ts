/**
 * Analytics Routes
 *
 * Server analysis, incident reporting, and batch analysis endpoints.
 * Uses specialized AI agents for natural language responses.
 *
 * @version 3.0.0 - Migrated to AI SDK v6 native
 * @created 2025-12-28
 * @updated 2026-01-24 - Removed @ai-sdk-tools/agents dependency
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { generateText } from 'ai';
import { logger } from '../lib/logger';
import {
  detectAnomalies,
  detectAnomaliesAllServers,
  predictTrends,
  analyzePattern,
} from '../tools-ai-sdk';
import { handleApiError, jsonSuccess } from '../lib/error-handler';
import { sanitizeChineseCharacters } from '../lib/text-sanitizer';
import { getReporterAgentConfig, isReporterAgentAvailable } from '../services/ai-sdk/agents/reporter-agent';
import { getAnalystAgentConfig, isAnalystAgentAvailable } from '../services/ai-sdk/agents/analyst-agent';
import {
  extractToolBasedData,
  parseAgentJsonResponse,
} from './analytics-report-utils';
// incident-rag-injector imports removed - endpoints deprecated

export const analyticsRouter = new Hono();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecoverableReporterError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return [
    'rate limit',
    'too many',
    'quota',
    '429',
    'timeout',
    'timed out',
    'deadline',
    '503',
    '502',
    '504',
    'service unavailable',
    'provider',
    'model',
  ].some((keyword) => message.includes(keyword));
}

/**
 * POST /analyze-server - Server Analysis Endpoint
 *
 * Hybrid approach: Tools for structured data + Agent for natural language insights.
 * Returns CloudRunAnalysisResponse format for frontend compatibility.
 *
 * @version 2.1.0 - Hybrid Tool + Agent approach (Frontend compatible)
 */
analyticsRouter.post('/analyze-server', async (c: Context) => {
  try {
    const { serverId, analysisType = 'full', options = {}, currentMetrics } = await c.req.json();

    logger.info(`[Analyze Server] serverId=${serverId}, type=${analysisType}`);

    // Type for metricType
    type MetricType = 'cpu' | 'memory' | 'disk' | 'all';
    const metricType = ((options.metricType as string) || 'all') as MetricType;
    const startTime = Date.now();

    // 1. Run tools directly for structured data (Frontend expects this format)
    const results: {
      serverId?: string;
      analysisType: string;
      anomalyDetection?: unknown;
      trendPrediction?: unknown;
      patternAnalysis?: unknown;
      aiInsights?: { summary: string; recommendations: string[]; confidence: number };
      _source: string;
      _durationMs?: number;
    } = {
      serverId,
      analysisType,
      _source: 'Hybrid (Tool + Agent)',
    };

    // Execute tools based on analysis type
    if (analysisType === 'anomaly' || analysisType === 'full') {
      results.anomalyDetection = await detectAnomalies.execute!({
        serverId: serverId || undefined,
        metricType,
        currentMetrics,
      }, { toolCallId: 'analyze-server-anomaly', messages: [] });
    }

    if (analysisType === 'trend' || analysisType === 'full') {
      results.trendPrediction = await predictTrends.execute!({
        serverId: serverId || undefined,
        metricType,
        predictionHours: (options.predictionHours as number) || 1,
      }, { toolCallId: 'analyze-server-trend', messages: [] });
    }

    if (analysisType === 'pattern' || analysisType === 'full') {
      results.patternAnalysis = await analyzePattern.execute!({
        query: (options.query as string) || '서버 상태 전체 분석',
      }, { toolCallId: 'analyze-server-pattern', messages: [] });
    }

    // 2. Use Agent for natural language insights (if available)
    const analystConfig = getAnalystAgentConfig();
    const analystModelResult = analystConfig?.getModel();
    if (analystConfig && analystModelResult && isAnalystAgentAvailable()) {
      try {
        const anomalyData = results.anomalyDetection as { hasAnomalies?: boolean; anomalyCount?: number } | undefined;
        const trendData = results.trendPrediction as { summary?: { hasRisingTrends?: boolean } } | undefined;

        const prompt = `분석 결과를 해석하고 권장 조치를 제안해주세요.

## 분석 데이터
- 이상 탐지: ${anomalyData?.hasAnomalies ? `${anomalyData.anomalyCount}개 이상 감지` : '정상'}
- 트렌드: ${trendData?.summary?.hasRisingTrends ? '상승 추세 있음' : '안정적'}

## 요청 사항
1. 현재 상태에 대한 간략한 요약 (2-3문장)
2. 권장 조치사항 (최대 3개)

JSON 형식으로 응답하세요:
{"summary": "...", "recommendations": ["...", "..."], "confidence": 0.9}`;

        const agentResult = await generateText({
          model: analystModelResult.model,
          messages: [
            { role: 'system', content: analystConfig.instructions },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          maxOutputTokens: 512,
        });

        // Sanitize Chinese characters from LLM output
        const sanitizedText = sanitizeChineseCharacters(agentResult.text);

        // Try to parse JSON from agent response
        const jsonMatch = sanitizedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const insights = JSON.parse(jsonMatch[0]);
            results.aiInsights = {
              summary: insights.summary || '',
              recommendations: insights.recommendations || [],
              confidence: insights.confidence || 0.8,
            };
          } catch {
            // If JSON parse fails, use sanitized text as summary
            results.aiInsights = {
              summary: sanitizedText.slice(0, 200),
              recommendations: [],
              confidence: 0.7,
            };
          }
        }
      } catch (agentError) {
        logger.warn({ err: agentError }, '[Analyze Server] Agent insight generation failed');
        // Continue without agent insights
      }
    }

    const durationMs = Date.now() - startTime;
    results._durationMs = durationMs;

    logger.info(`[Analyze Server] Completed in ${durationMs}ms`);
    return jsonSuccess(c, results);
  } catch (error) {
    return handleApiError(c, error, 'Analyze Server');
  }
});

// Note: parseAnalystResponse and analyzeServerFallback removed in v2.1.0
// Main endpoint now uses hybrid approach (Tools + Agent)

/**
 * POST /incident-report - Incident Report Generation
 *
 * Uses Reporter Agent for natural language report generation.
 * Agent calls tools internally and synthesizes results.
 *
 * @version 2.1.0 - Structured JSON output + Enhanced parsing (ITIL-aligned)
 */
analyticsRouter.post('/incident-report', async (c: Context) => {
  try {
    const { serverId, query, severity, category, metrics, action } = await c.req.json();

    logger.info(`[Incident Report] action=${action}, serverId=${serverId}`);

    const startTime = Date.now();

    // 1. Collect real-time data from tools first (parallel execution)
    // Use detectAnomaliesAllServers to get full system summary for incident reports
    const [anomalyData, trendData, timelineData] = await Promise.all([
      detectAnomaliesAllServers.execute!(
        { metricType: 'all' },
        { toolCallId: 'ir-anomaly-all', messages: [] }
      ),
      predictTrends.execute!(
        { serverId: serverId || undefined, metricType: 'all', predictionHours: 1 },
        { toolCallId: 'ir-trend', messages: [] }
      ),
      serverId
        ? (await import('../tools-ai-sdk/index.js').then((m) =>
            m.buildIncidentTimeline.execute!(
              { serverId, timeRangeHours: 6 },
              { toolCallId: 'ir-timeline', messages: [] }
            )
          ))
        : null,
    ]);

    // 2. Extract structured data from tool results
    const toolBasedData = extractToolBasedData(anomalyData, trendData, timelineData, serverId);

    // Check if Reporter Agent is available
    const reporterConfig = getReporterAgentConfig();
    const reporterModelResult = reporterConfig?.getModel();
    const createToolBasedFallback = (
      source: string,
      fallbackReason?: string
    ) => ({
      ...toolBasedData,
      created_at: new Date().toISOString(),
      _source: source,
      _durationMs: Date.now() - startTime,
      ...(fallbackReason ? { _fallbackReason: fallbackReason } : {}),
    });

    if (!reporterConfig || !reporterModelResult || !isReporterAgentAvailable()) {
      logger.warn('[Incident Report] Reporter Agent unavailable, using tool-based fallback');
      return jsonSuccess(
        c,
        createToolBasedFallback(
          'Tool-based Fallback (No Agent)',
          'reporter_unavailable'
        )
      );
    }

    // 3. Build prompt for Reporter Agent with JSON output request
    const metricsContext =
      metrics && metrics.length > 0
        ? `\n현재 서버 메트릭:\n${metrics
            .map(
              (m: { server_name: string; cpu: number; memory: number; disk: number }) =>
                `- ${m.server_name}: CPU ${m.cpu.toFixed(1)}%, Memory ${m.memory.toFixed(1)}%, Disk ${m.disk.toFixed(1)}%`
            )
            .join('\n')}`
        : '';

    const prompt = `서버 장애 보고서를 JSON 형식으로 생성해주세요.

## 요청 정보
- 대상 서버: ${serverId || '전체 서버'}
- 상황: ${query || '현재 시스템 상태 분석'}
- 심각도 힌트: ${severity || '자동 판단'}
- 카테고리: ${category || '일반'}
${metricsContext}

## 현재 수집된 데이터
- 이상 감지: ${JSON.stringify(anomalyData).slice(0, 500)}
- 트렌드: ${JSON.stringify(trendData).slice(0, 300)}

## 중요: 반드시 아래 JSON 형식으로만 응답하세요

\`\`\`json
{
  "title": "간결한 상황 요약 (예: 웹 서버 CPU 과부하 경고)",
  "severity": "critical|high|medium|low 중 하나",
  "description": "현재 상황에 대한 상세 설명 (2-3문장)",
  "affected_servers": ["서버ID1", "서버ID2"],
  "root_cause": "근본 원인 분석 결과",
  "recommendations": [
    {"action": "조치 내용", "priority": "high|medium|low", "expected_impact": "예상 효과"}
  ],
  "pattern": "감지된 패턴 설명"
}
\`\`\`

위 형식의 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

    logger.info('[Incident Report] Invoking Reporter Agent with JSON output...');

    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: reporterModelResult.model,
        messages: [
          { role: 'system', content: reporterConfig.instructions },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        maxOutputTokens: 1024,
      });
    } catch (reporterError) {
      if (isRecoverableReporterError(reporterError)) {
        const reason = getErrorMessage(reporterError);
        logger.warn(
          { err: reporterError },
          '[Incident Report] Reporter Agent degraded, using tool-based fallback'
        );
        return jsonSuccess(
          c,
          createToolBasedFallback('Tool-based Fallback (Reporter Degraded)', reason)
        );
      }

      throw reporterError;
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[Incident Report] Agent completed in ${durationMs}ms`);

    // 4. Sanitize Chinese characters and parse JSON from agent response
    const sanitizedText = sanitizeChineseCharacters(result.text);
    const agentReport = parseAgentJsonResponse(sanitizedText, toolBasedData);

    // 5. Merge tool-based data with agent response (agent takes precedence for text fields)
    const finalReport = {
      id: toolBasedData.id,
      title: agentReport.title || toolBasedData.title,
      severity: agentReport.severity || toolBasedData.severity,
      description: agentReport.description || toolBasedData.description,
      affected_servers: agentReport.affected_servers.length > 0
        ? agentReport.affected_servers
        : toolBasedData.affected_servers,
      anomalies: toolBasedData.anomalies, // From tool
      system_summary: toolBasedData.system_summary, // From tool
      timeline: toolBasedData.timeline, // From tool
      root_cause_analysis: {
        primary_cause: agentReport.root_cause || '도구 분석 결과를 참조하세요',
        contributing_factors: [],
      },
      recommendations: agentReport.recommendations.length > 0
        ? agentReport.recommendations
        : toolBasedData.recommendations,
      pattern: agentReport.pattern || toolBasedData.pattern,
      created_at: new Date().toISOString(),
      _agentResponse: sanitizedText,
      _source: 'Reporter Agent + Tool Data (Hybrid)',
      _durationMs: durationMs,
    };

    return jsonSuccess(c, finalReport);
  } catch (error) {
    return handleApiError(c, error, 'Incident Report');
  }
});

// analyze-batch endpoint removed - not used by frontend

// RAG sync/stats endpoints removed - not used by frontend
