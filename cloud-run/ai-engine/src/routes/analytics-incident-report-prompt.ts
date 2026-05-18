import type {
  DomainDataSource,
  DomainHistoryEntry,
  DomainSnapshot,
} from '../core/assistant-runtime';
import type { QueryAsOf } from '../data/query-as-of-context';
import { logger } from '../lib/logger';
import type { PipelineResult } from '../services/ai-sdk/agents/reporter-pipeline';
import type {
  MonitoringDataSource,
  MonitoringSnapshot,
} from '../services/monitoring/monitoring-data-source';

export const REPORTER_STRUCTURED_OUTPUT_MAX_TOKENS = 3072;

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

function stringifyForPrompt(value: unknown, maxChars = 6000): string {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized.length <= maxChars) {
    return serialized;
  }

  return `${serialized.slice(0, maxChars)}\n...<truncated ${serialized.length - maxChars} chars>`;
}

export function createReporterPipelineDataSource(
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
                points: Math.max(
                  1,
                  Math.min(count, REPORTER_PIPELINE_HISTORY_POINTS)
                ),
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
    return stringifyForPrompt(
      {
        success: false,
        error: result.error,
        quality: result.quality,
        metadata: result.metadata,
      },
      1800
    );
  }

  return stringifyForPrompt(
    {
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
    },
    4200
  );
}

export function buildReporterPipelineMetadata(
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

export function buildIncidentReportPrompt(input: {
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
