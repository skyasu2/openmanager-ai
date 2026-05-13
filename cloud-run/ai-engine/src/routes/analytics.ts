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
import { generateText, Output } from 'ai';
import { logger } from '../lib/logger';
import {
  detectAnomalies,
  detectAnomaliesAllServers,
  predictTrends,
  analyzePattern,
} from '../tools-ai-sdk';
import { handleApiError, jsonSuccess } from '../lib/error-handler';
import { sanitizeJsonStrings } from '../lib/text-sanitizer';
import {
  normalizeQueryAsOf,
  runWithQueryAsOf,
} from '../data/query-as-of-context';
import { getAgentConfig } from '../services/ai-sdk/agents/config';
import { AgentFactory } from '../services/ai-sdk/agents/agent-factory';
import {
  extractToolBasedData,
  IncidentReportOutputSchema,
  normalizeAgentIncidentReportOutput,
  type IncidentReportOutput,
} from './analytics-report-utils';
import {
  createMonitoringDataSource,
  type MonitoringEvidenceRef,
  type MonitoringIncidentTimeline,
  type MonitoringSnapshot,
  type MonitoringSourceMode,
} from '../services/monitoring/monitoring-data-source';
import {
  handleMonitoringApiError,
  type MonitoringApiErrorContext,
} from './analytics-monitoring-error';
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

interface AnalyzeServerInsights {
  summary: string;
  recommendations: string[];
  confidence: number;
}

interface AnalyzeServerToolResults {
  anomalyDetection?: unknown;
  trendPrediction?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readMonitoringSourceMode(value: unknown): MonitoringSourceMode | undefined {
  return value === 'replay-json' || value === 'live-otel' ? value : undefined;
}

function buildAnalyzeBatchSummary(snapshot: MonitoringSnapshot): string {
  const affectedServerCount = new Set(
    snapshot.riskSignals.map((signal) => signal.serverId)
  ).size;
  const criticalCount = snapshot.riskSignals.filter(
    (signal) => signal.severity === 'critical'
  ).length;
  const warningCount = snapshot.riskSignals.filter(
    (signal) => signal.severity === 'warning'
  ).length;

  if (snapshot.riskSignals.length === 0) {
    return `${snapshot.topology.totalServers}대 서버가 정상 범위입니다. 현재 즉시 조치가 필요한 risk signal은 없습니다.`;
  }

  return `${affectedServerCount}대 서버에서 ${snapshot.riskSignals.length}개 risk signal이 감지되었습니다. critical ${criticalCount}개, warning ${warningCount}개입니다.`;
}

interface ReporterMonitoringGrounding {
  sourceMode?: MonitoringSourceMode;
  queryAsOf?: string;
  evidenceRefs: MonitoringEvidenceRef[];
  timeline: MonitoringIncidentTimeline | null;
}

function mergeEvidenceRefs(
  evidenceRefs: MonitoringEvidenceRef[]
): MonitoringEvidenceRef[] {
  const refsById = new Map<string, MonitoringEvidenceRef>();
  for (const evidenceRef of evidenceRefs) {
    if (!refsById.has(evidenceRef.id)) {
      refsById.set(evidenceRef.id, evidenceRef);
    }
  }
  return Array.from(refsById.values()).slice(0, 40);
}

async function collectReporterMonitoringGrounding(input: {
  sourceMode: unknown;
  queryAsOf: unknown;
  serverId?: string;
}): Promise<ReporterMonitoringGrounding> {
  try {
    const source = createMonitoringDataSource({
      mode: readMonitoringSourceMode(input.sourceMode),
    });
    const queryAsOf = normalizeQueryAsOf(input.queryAsOf);
    const [snapshot, timeline] = await Promise.all([
      source.getSnapshot({ queryAsOf }),
      source.buildIncidentTimeline({
        queryAsOf,
        serverId: input.serverId,
        limit: 20,
      }),
    ]);

    return {
      sourceMode: snapshot.sourceMode,
      queryAsOf: snapshot.queryAsOf,
      evidenceRefs: mergeEvidenceRefs([
        ...snapshot.evidenceRefs,
        ...timeline.evidenceRefs,
      ]),
      timeline,
    };
  } catch (error) {
    logger.warn(
      { err: error },
      '[Incident Report] Monitoring grounding unavailable, continuing with legacy tools'
    );
    return {
      evidenceRefs: [],
      timeline: null,
    };
  }
}

function buildMonitoringEvidenceContext(
  grounding: ReporterMonitoringGrounding
): string {
  if (grounding.evidenceRefs.length === 0) {
    return '';
  }

  return `
- Monitoring sourceMode: ${grounding.sourceMode ?? 'unknown'}
- Monitoring queryAsOf: ${grounding.queryAsOf ?? 'unknown'}
- Monitoring evidenceRefs: ${JSON.stringify(grounding.evidenceRefs.slice(0, 8)).slice(0, 900)}
- Monitoring timeline: ${JSON.stringify(grounding.timeline?.events.slice(0, 8) ?? []).slice(0, 500)}`;
}

async function readRequestBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function buildDeterministicAnalyzeServerInsights(
  results: AnalyzeServerToolResults
): AnalyzeServerInsights {
  const anomalyData = isRecord(results.anomalyDetection)
    ? results.anomalyDetection
    : {};
  const trendData = isRecord(results.trendPrediction)
    ? results.trendPrediction
    : {};
  const trendSummary = isRecord(trendData.summary) ? trendData.summary : {};

  const hasAnomalies = readBoolean(anomalyData.hasAnomalies);
  const anomalyCount = readNumber(anomalyData.anomalyCount) ?? 0;
  const hasRisingTrends = readBoolean(trendSummary.hasRisingTrends);

  if (hasAnomalies) {
    return {
      summary: `이상 탐지에서 ${anomalyCount}개 항목이 감지되었습니다. 관련 서버의 CPU, Memory, Disk 지표를 우선 확인하세요.`,
      recommendations: [
        '이상 감지된 메트릭의 최근 10분 변화와 직전 배포/배치 작업을 대조하세요.',
        '영향 서버의 상위 프로세스와 연결 수를 확인하고 필요 시 트래픽 분산을 적용하세요.',
      ],
      confidence: 0.88,
    };
  }

  if (hasRisingTrends) {
    return {
      summary: '현재 이상 탐지는 정상이지만 일부 지표에 상승 추세가 있습니다. 임계값 도달 가능성을 계속 관찰하세요.',
      recommendations: [
        '상승 추세가 있는 메트릭의 다음 1시간 예측값과 임계값까지의 여유를 확인하세요.',
        '동일 추세가 10분 이상 유지되면 관련 서버의 예약 작업과 트래픽 증가 요인을 점검하세요.',
      ],
      confidence: 0.84,
    };
  }

  return {
    summary: '이상 탐지와 추세 예측 모두 안정적입니다. 현재는 즉시 조치가 필요한 서버가 없습니다.',
    recommendations: [
      '현재 모니터링 주기를 유지하세요.',
      '리소스 사용률 상위 서버는 정기 점검 대상으로만 추적하세요.',
    ],
    confidence: 0.9,
  };
}

/**
 * POST /monitoring/snapshot - deterministic monitoring snapshot
 *
 * Shared contract for Chat, Reporter, and Analyst grounding.
 */
analyticsRouter.post('/monitoring/snapshot', async (c: Context) => {
  let errorContext: MonitoringApiErrorContext = {};

  try {
    const body = await readRequestBody(c);
    const sourceMode = readMonitoringSourceMode(body.sourceMode);
    const queryAsOf = normalizeQueryAsOf(body.queryAsOf);
    errorContext = { sourceMode, queryAsOf };
    const source = createMonitoringDataSource({
      mode: sourceMode,
    });
    const snapshot = await source.getSnapshot({
      queryAsOf,
    });

    return jsonSuccess(c, snapshot);
  } catch (error) {
    return handleMonitoringApiError(
      c,
      error,
      'Monitoring Snapshot',
      errorContext
    ) ?? handleApiError(c, error, 'Monitoring Snapshot');
  }
});

/**
 * POST /monitoring/analyze-batch - deterministic Analyst batch summary
 *
 * Keeps Vercel as a thin proxy and avoids per-server LLM fan-out.
 */
analyticsRouter.post('/monitoring/analyze-batch', async (c: Context) => {
  let errorContext: MonitoringApiErrorContext = {};

  try {
    const body = await readRequestBody(c);
    const sourceMode = readMonitoringSourceMode(body.sourceMode);
    const queryAsOf = normalizeQueryAsOf(body.queryAsOf);
    errorContext = { sourceMode, queryAsOf };
    const source = createMonitoringDataSource({
      mode: sourceMode,
    });
    const snapshot = await source.getSnapshot({
      queryAsOf,
    });

    return jsonSuccess(c, {
      sourceMode: snapshot.sourceMode,
      queryAsOf: snapshot.queryAsOf,
      slot: snapshot.slot,
      summary: buildAnalyzeBatchSummary(snapshot),
      servers: snapshot.servers,
      riskSignals: snapshot.riskSignals,
      evidenceRefs: snapshot.evidenceRefs,
      dataFreshness: snapshot.dataFreshness,
      _source: 'Monitoring Snapshot (Deterministic)',
    });
  } catch (error) {
    return handleMonitoringApiError(
      c,
      error,
      'Monitoring Analyze Batch',
      errorContext
    ) ?? handleApiError(c, error, 'Monitoring Analyze Batch');
  }
});

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
    const {
      serverId,
      analysisType = 'full',
      options = {},
      currentMetrics,
      queryAsOf: rawQueryAsOf,
    } = await c.req.json();

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

    const queryAsOf = normalizeQueryAsOf(rawQueryAsOf);

    await runWithQueryAsOf(queryAsOf, async () => {
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
    });

    // 2. Build deterministic insights.
    // Full-system Analyst runs fan out across all servers. Calling an LLM per
    // server can exceed free-tier RPM limits, so keep this endpoint tool-only.
    results.aiInsights = buildDeterministicAnalyzeServerInsights(results);

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
    const { serverId, query, severity, category, metrics, action, sourceMode, queryAsOf: rawQueryAsOf } = await c.req.json();

    logger.info(`[Incident Report] action=${action}, serverId=${serverId}`);

    const startTime = Date.now();

    // 1. Collect real-time data from tools first (parallel execution)
    // Use detectAnomaliesAllServers to get full system summary for incident reports
    const normalizedQueryAsOf = normalizeQueryAsOf(rawQueryAsOf);
    const [anomalyData, trendData, timelineData, monitoringGrounding] =
      await runWithQueryAsOf(normalizedQueryAsOf, async () =>
        Promise.all([
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
          collectReporterMonitoringGrounding({
            sourceMode,
            queryAsOf: rawQueryAsOf,
            serverId,
          }),
        ])
      );

    // 2. Extract structured data from tool results
    const toolBasedData = extractToolBasedData(anomalyData, trendData, timelineData, serverId);

    // Check if Reporter Agent is available
    const reporterConfig = getAgentConfig('Reporter Agent');
    const reporterModelResult = reporterConfig.getModel();
    const createToolBasedFallback = (
      source: string,
      fallbackReason?: string
    ) => ({
      ...toolBasedData,
      sourceMode: monitoringGrounding.sourceMode,
      queryAsOf: monitoringGrounding.queryAsOf,
      evidenceRefs: monitoringGrounding.evidenceRefs,
      monitoringTimeline: monitoringGrounding.timeline?.events ?? [],
      created_at: new Date().toISOString(),
      _source: source,
      _durationMs: Date.now() - startTime,
      ...(fallbackReason ? { _fallbackReason: fallbackReason } : {}),
    });

    if (!reporterModelResult || !AgentFactory.isAvailable('reporter')) {
      logger.warn('[Incident Report] Reporter Agent unavailable, using tool-based fallback');
      return jsonSuccess(
        c,
        createToolBasedFallback(
          'Tool-based Fallback (No Agent)',
          'reporter_unavailable'
        )
      );
    }

    // 3. Build prompt for Reporter Agent with AI SDK structured output.
    const metricsContext =
      metrics && metrics.length > 0
        ? `\n현재 서버 메트릭:\n${metrics
            .map(
              (m: { server_name: string; cpu: number; memory: number; disk: number }) =>
                `- ${m.server_name}: CPU ${m.cpu.toFixed(1)}%, Memory ${m.memory.toFixed(1)}%, Disk ${m.disk.toFixed(1)}%`
            )
            .join('\n')}`
        : '';

    const prompt = `서버 장애 보고서의 구조화 필드를 작성해주세요.

## 요청 정보
- 대상 서버: ${serverId || '전체 서버'}
- 상황: ${query || '현재 시스템 상태 분석'}
- 심각도 힌트: ${severity || '자동 판단'}
- 카테고리: ${category || '일반'}
${metricsContext}

## 현재 수집된 데이터
- 이상 감지: ${JSON.stringify(anomalyData).slice(0, 500)}
- 트렌드: ${JSON.stringify(trendData).slice(0, 300)}
- 타임라인: ${JSON.stringify(timelineData).slice(0, 300)}
${buildMonitoringEvidenceContext(monitoringGrounding)}

## 작성 필드
- title: 간결한 상황 요약
- severity: critical, high, medium, low, warning, info 중 하나
- description: 현재 상황에 대한 상세 설명 2-3문장
- affected_servers: 관련 서버 ID 목록
- affectedServers: 관련 서버별 id, name, severity, metric, value
- root_cause: 근본 원인 분석 결과
- recommendations: action, priority, expected_impact 형식의 조치 목록
- pattern: 감지된 패턴 설명
- postmortem: timeline, hypotheses, prevention 목록`;

    logger.info('[Incident Report] Invoking Reporter Agent with JSON output...');

    let agentReportOutput: IncidentReportOutput;
    try {
      const result = await generateText({
        model: reporterModelResult.model,
        system: reporterConfig.instructions,
        messages: [{ role: 'user', content: prompt }],
        output: Output.object({
          schema: IncidentReportOutputSchema,
          name: 'incident_report',
          description:
            'Structured incident report for server monitoring analysis.',
        }),
        temperature: 0.4,
        maxOutputTokens: 1024,
      });
      agentReportOutput = sanitizeJsonStrings(result.output);
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

    // 4. Normalize structured agent output with deterministic tool fallback fields.
    const agentReport = normalizeAgentIncidentReportOutput(
      agentReportOutput,
      toolBasedData
    );

    // 5. Merge tool-based data with agent response (agent takes precedence for text fields)
    const finalReport = {
      id: toolBasedData.id,
      title: agentReport.title || toolBasedData.title,
      severity: agentReport.severity || toolBasedData.severity,
      description: agentReport.description || toolBasedData.description,
      affected_servers: agentReport.affected_servers.length > 0
        ? agentReport.affected_servers
        : toolBasedData.affected_servers,
      affectedServers: agentReport.affectedServers.length > 0
        ? agentReport.affectedServers
        : toolBasedData.affectedServers,
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
      postmortem: agentReport.postmortem,
      sourceMode: monitoringGrounding.sourceMode,
      queryAsOf: monitoringGrounding.queryAsOf,
      evidenceRefs: monitoringGrounding.evidenceRefs,
      monitoringTimeline: monitoringGrounding.timeline?.events ?? [],
      created_at: new Date().toISOString(),
      _agentResponse: JSON.stringify(agentReportOutput),
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
