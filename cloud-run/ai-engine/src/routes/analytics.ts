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
  type QueryAsOf,
} from '../data/query-as-of-context';
import type {
  DomainDataSource,
  DomainHistoryEntry,
  DomainSnapshot,
} from '../core/assistant-runtime';
import { getAgentConfig } from '../services/ai-sdk/agents/config';
import { AgentFactory } from '../services/ai-sdk/agents/agent-factory';
import {
  executeReporterPipeline,
  type PipelineResult,
} from '../services/ai-sdk/agents/reporter-pipeline';
import {
  extractToolBasedData,
  getReporterDegradationReasonCode,
  IncidentReportOutputSchema,
  mergeIncidentRecommendations,
  normalizeAgentIncidentReportOutput,
  type IncidentReportOutput,
} from './analytics-report-utils';
import { buildMonitoringCapacityAlerts } from './analytics-capacity-alerts';
import {
  createMonitoringDataSource,
  type MonitoringDataSource,
  type MonitoringSnapshot,
} from '../services/monitoring/monitoring-data-source';
import {
  handleMonitoringApiError,
  type MonitoringApiErrorContext,
} from './analytics-monitoring-error';
import {
  buildAnalyzeBatchSummary,
  buildDeterministicAnalyzeServerInsights,
  isRecord,
  readMonitoringSourceMode,
} from './analytics-route-utils';
import {
  collectReporterMonitoringGrounding,
} from './analytics-reporter-grounding';
// incident-rag-injector imports removed - endpoints deprecated

export const analyticsRouter = new Hono();

const REPORTER_STRUCTURED_OUTPUT_MAX_TOKENS = 3072;
const REPORTER_PIPELINE_HISTORY_POINTS = 12;
const REPORTER_PIPELINE_METRICS = [
  'cpu',
  'memory',
  'disk',
  'network',
] as const;

type ReporterPipelineMetric = (typeof REPORTER_PIPELINE_METRICS)[number];

interface ReporterPipelineHistoryServer {
  id: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
}

interface ReporterPipelineHistoryRow {
  timestamp: string;
  slotIndex?: number;
  servers: Map<string, ReporterPipelineHistoryServer>;
}

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
    'invalid json schema',
    'expected schema',
    'response_format',
    'failed_generation',
    'jsonschema',
    'no object generated',
    'could not parse',
    'parse the response',
  ].some((keyword) => message.includes(keyword));
}

async function readRequestBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function stringifyForPrompt(value: unknown, maxChars = 6000): string {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized.length <= maxChars) {
    return serialized;
  }

  return `${serialized.slice(0, maxChars)}\n...<truncated ${serialized.length - maxChars} chars>`;
}

function createReporterPipelineDataSource(
  source: MonitoringDataSource,
  queryAsOf: QueryAsOf | undefined
): DomainDataSource {
  let snapshotPromise: Promise<MonitoringSnapshot> | undefined;

  const getSnapshot = async (): Promise<MonitoringSnapshot> => {
    snapshotPromise ??= source.getSnapshot({ queryAsOf });
    return snapshotPromise;
  };

  return {
    async snapshot(): Promise<DomainSnapshot> {
      const snapshot = await getSnapshot();
      return {
        timestamp: snapshot.queryAsOf,
        data: {
          timestamp: snapshot.queryAsOf,
          sourceMode: snapshot.sourceMode,
          slot: snapshot.slot,
          servers: snapshot.servers,
        },
      };
    },
    async history(count): Promise<DomainHistoryEntry[]> {
      const snapshot = await getSnapshot();
      const rows = new Map<string, ReporterPipelineHistoryRow>();

      await Promise.all(
        snapshot.servers.flatMap((server) =>
          REPORTER_PIPELINE_METRICS.map(async (metric) => {
            try {
              const series = await source.getMetricSeries({
                serverId: server.id,
                metric: metric as ReporterPipelineMetric,
                points: Math.max(1, Math.min(count, REPORTER_PIPELINE_HISTORY_POINTS)),
                queryAsOf,
              });

              for (const point of series.points) {
                const existing = rows.get(point.timestamp) ?? {
                  timestamp: point.timestamp,
                  ...(typeof point.slotIndex === 'number'
                    ? { slotIndex: point.slotIndex }
                    : {}),
                  servers: new Map<string, ReporterPipelineHistoryServer>(),
                };
                const serverRow =
                  existing.servers.get(server.id) ?? { id: server.id };
                serverRow[metric] = point.value;
                existing.servers.set(server.id, serverRow);
                rows.set(point.timestamp, existing);
              }
            } catch (error) {
              logger.warn(
                { err: error, serverId: server.id, metric },
                '[Incident Report] Reporter pipeline metric series unavailable'
              );
            }
          })
        )
      );

      return Array.from(rows.values())
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
        .map((row) => ({
          timestamp: row.timestamp,
          ...(typeof row.slotIndex === 'number'
            ? { slotIndex: row.slotIndex }
            : {}),
          data: {
            timestamp: row.timestamp,
            servers: Array.from(row.servers.values()),
          },
        }));
    },
  };
}

function buildReporterPipelinePromptContext(
  result: PipelineResult | null
): string {
  if (!result) {
    return 'Reporter pipeline was not executed.';
  }

  if (!result.success || !result.report) {
    return stringifyForPrompt({
      success: false,
      error: result.error,
      quality: result.quality,
      metadata: result.metadata,
    }, 1800);
  }

  return stringifyForPrompt({
    success: true,
    quality: result.quality,
    stages: result.metadata.pipelineStages,
    optimizationsApplied: result.metadata.optimizationsApplied,
    report: {
      title: result.report.title,
      summary: result.report.summary,
      affectedServers: result.report.affectedServers,
      timeline: result.report.timeline,
      rootCause: result.report.rootCause,
      warnings: result.report.warnings,
      predictions: result.report.predictions,
      suggestedActions: result.report.suggestedActions,
      sla: result.report.sla,
    },
  }, 4200);
}

function buildReporterPipelineMetadata(
  result: PipelineResult | null
):
  | {
      success: boolean;
      quality: PipelineResult['quality'];
      pipelineStages: PipelineResult['metadata']['pipelineStages'];
      optimizationsApplied: string[];
      error?: string;
    }
  | undefined {
  if (!result) {
    return undefined;
  }

  return {
    success: result.success,
    quality: result.quality,
    pipelineStages: result.metadata.pipelineStages,
    optimizationsApplied: result.metadata.optimizationsApplied,
    ...(result.error ? { error: result.error } : {}),
  };
}

function buildIncidentReportPrompt(input: {
  serverId?: string;
  query?: string;
  severity?: string;
  category?: string;
  metricsContext: string;
  toolBasedData: unknown;
  anomalyData: unknown;
  trendData: unknown;
  timelineData: unknown;
  monitoringGrounding: {
    sourceMode?: string;
    queryAsOf?: string;
    evidenceRefs: unknown[];
    timeline?: { events?: unknown[] } | null;
  };
  reporterPipelineResult: PipelineResult | null;
}): string {
  return `증거 기반 서버 장애 보고서를 구조화 JSON으로 작성하세요.

## 요청 정보
- 대상 서버: ${input.serverId || '전체 서버'}
- 상황: ${input.query || '현재 시스템 상태 분석'}
- 심각도 힌트: ${input.severity || '자동 판단'}
- 카테고리: ${input.category || '일반'}
${input.metricsContext}

## 분석 과제
1. 타임라인을 시간순으로 재구성하고 선행/후행 관계를 식별하세요.
2. 메트릭, 로그, 토폴로지 증거를 연결해 "원인 → 전파 → 현상" 인과 체인을 작성하세요.
3. DB, WAS/API, storage, load balancer 사이의 전파 방향이 보이면 root_cause와 postmortem.hypotheses에 명시하세요.
4. 불확실한 항목은 단정하지 말고 신뢰도 또는 가설 표현으로 제한하세요.
5. recommendations.action에는 운영자가 바로 실행할 수 있는 읽기 전용 확인 명령어를 "명령어: \`...\`" 형식으로 포함하세요.

## Reporter pipeline baseline
${buildReporterPipelinePromptContext(input.reporterPipelineResult)}

## Deterministic tool report
${stringifyForPrompt(input.toolBasedData, 5200)}

## Raw tool signals
- anomalyData: ${stringifyForPrompt(input.anomalyData, 2600)}
- trendData: ${stringifyForPrompt(input.trendData, 1800)}
- legacyTimelineData: ${stringifyForPrompt(input.timelineData, 1800)}

## Monitoring evidenceRefs
${stringifyForPrompt(input.monitoringGrounding.evidenceRefs.slice(0, 12), 3600)}

## Monitoring timeline
${stringifyForPrompt(input.monitoringGrounding.timeline?.events?.slice(0, 12) ?? [], 3600)}

## 출력 필드
- title: 간결한 상황 요약
- severity: critical, high, medium, low, warning, info 중 하나
- description: 현재 상황에 대한 상세 설명 2-3문장
- affected_servers: 관련 서버 ID 목록
- affectedServers: 관련 서버별 id, name, severity, metric, value
- root_cause: 가장 가능성 높은 근본 원인과 인과 체인
- recommendations: action, priority, expected_impact 형식의 조치 목록
- pattern: 감지된 패턴 설명
- postmortem: timeline, hypotheses, prevention 목록`;
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
    const capacity = await buildMonitoringCapacityAlerts({
      source,
      snapshot,
      queryAsOf,
    });

    return jsonSuccess(c, {
      sourceMode: snapshot.sourceMode,
      queryAsOf: snapshot.queryAsOf,
      slot: snapshot.slot,
      summary: buildAnalyzeBatchSummary(snapshot),
      servers: snapshot.servers,
      riskSignals: snapshot.riskSignals,
      capacityAlerts: capacity.alerts,
      evidenceRefs: [...snapshot.evidenceRefs, ...capacity.evidenceRefs].slice(
        0,
        40
      ),
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
    const toolBasedData = extractToolBasedData(
      anomalyData,
      trendData,
      timelineData,
      serverId,
      monitoringGrounding
    );

    // Check if Reporter Agent is available
    const reporterConfig = getAgentConfig('Reporter Agent');
    const reporterModelResult = reporterConfig.getModel();
    let reporterPipelineResult: PipelineResult | null = null;
    const createToolBasedFallback = (
      source: string,
      fallbackReason?: string
    ) => {
      const reporterPipeline = buildReporterPipelineMetadata(
        reporterPipelineResult
      );
      return {
        ...toolBasedData,
        degraded: true,
        fallbackSource: 'tool-based',
        fallbackReasonCode: getReporterDegradationReasonCode(fallbackReason),
        ...(reporterPipeline ? { reporterPipeline } : {}),
        sourceMode: monitoringGrounding.sourceMode,
        queryAsOf: monitoringGrounding.queryAsOf,
        evidenceRefs: monitoringGrounding.evidenceRefs,
        monitoringTimeline: monitoringGrounding.timeline?.events ?? [],
        created_at: new Date().toISOString(),
        _source: source,
        _durationMs: Date.now() - startTime,
      };
    };

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

    const reporterQuery =
      query ||
      `${serverId || '전체 서버'} 장애 보고서 생성: ${severity || '자동 심각도'} ${category || '일반'}`;
    const reporterPipelineSource = createMonitoringDataSource({
      mode: readMonitoringSourceMode(sourceMode),
    });
    reporterPipelineResult = await executeReporterPipeline(reporterQuery, {
      qualityThreshold: 0.75,
      maxIterations: 2,
      timeout: 45_000,
      dataSource: createReporterPipelineDataSource(
        reporterPipelineSource,
        normalizedQueryAsOf
      ),
      domainId: 'monitoring',
    });

    const prompt = buildIncidentReportPrompt({
      serverId,
      query,
      severity,
      category,
      metricsContext,
      toolBasedData,
      anomalyData,
      trendData,
      timelineData,
      monitoringGrounding,
      reporterPipelineResult,
    });

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
        maxOutputTokens: REPORTER_STRUCTURED_OUTPUT_MAX_TOKENS,
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
    const recommendations = mergeIncidentRecommendations(
      toolBasedData.recommendations,
      agentReport.recommendations
    );

    // 5. Merge tool-based data with agent response (agent takes precedence for text fields)
    const reporterPipeline = buildReporterPipelineMetadata(
      reporterPipelineResult
    );
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
      recommendations,
      pattern: agentReport.pattern || toolBasedData.pattern,
      postmortem: agentReport.postmortem,
      sourceMode: monitoringGrounding.sourceMode,
      queryAsOf: monitoringGrounding.queryAsOf,
      evidenceRefs: monitoringGrounding.evidenceRefs,
      monitoringTimeline: monitoringGrounding.timeline?.events ?? [],
      ...(reporterPipeline ? { reporterPipeline } : {}),
      created_at: new Date().toISOString(),
      _agentResponse: JSON.stringify(agentReportOutput),
      _source: 'Reporter Agent + Reporter Pipeline + Tool Data (Hybrid)',
      _durationMs: durationMs,
    };

    return jsonSuccess(c, finalReport);
  } catch (error) {
    return handleApiError(c, error, 'Incident Report');
  }
});

// analyze-batch endpoint removed - not used by frontend

// RAG sync/stats endpoints removed - not used by frontend
