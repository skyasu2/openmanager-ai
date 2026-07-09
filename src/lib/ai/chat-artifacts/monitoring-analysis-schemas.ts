import { z } from 'zod';
import type {
  CloudRunAnalysisResponse,
  MonitoringBatch24hMetricSummary,
  MonitoringBatchAnalysisResponse,
} from '@/types/intelligent-monitoring.types';

const MonitoringBatchServerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.enum(['online', 'warning', 'critical', 'offline']),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    network: z.number(),
  })
  .passthrough();

const MonitoringBatchRiskSignalSchema = z
  .object({
    id: z.string(),
    serverId: z.string(),
    serverName: z.string(),
    serverType: z.string(),
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    value: z.number(),
    threshold: z.number(),
    trend: z.enum(['up', 'down', 'stable']),
    severity: z.enum(['warning', 'critical']),
    evidenceRefId: z.string(),
  })
  .passthrough();

const MonitoringBatchQueryFocusServerSchema = z.object({
  serverId: z.string(),
  serverName: z.string(),
  serverType: z.string(),
  status: z.enum(['online', 'warning', 'critical', 'offline']),
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  network: z.number(),
  matchedBy: z.literal('query'),
});

const MonitoringBatchCapacityAlertSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  serverName: z.string(),
  serverType: z.string(),
  metric: z.enum(['cpu', 'memory', 'disk', 'network']),
  currentValue: z.number(),
  predictedValue: z.number(),
  warningThreshold: z.number(),
  criticalThreshold: z.number(),
  willBreachWarning: z.boolean(),
  timeToWarningMinutes: z.number().nullable(),
  willBreachCritical: z.boolean(),
  timeToCriticalMinutes: z.number().nullable(),
  severity: z.enum(['warning', 'critical']),
  humanReadable: z.string(),
  evidenceRefId: z.string(),
});

const MonitoringBatchEvidenceRefBaseSchema = z.object({
  id: z.string(),
  kind: z.enum(['metric', 'log', 'topology', 'rule', 'prediction']),
  serverId: z.string().optional(),
  metric: z.string().optional(),
  timeRange: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .passthrough(),
  summary: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  threshold: z.number().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
});

const MonitoringBatchEvidenceRefSchema =
  MonitoringBatchEvidenceRefBaseSchema.passthrough();

const MonitoringBatchFactEvidenceRefSchema = z.object({
  id: z.string(),
  kind: z.enum(['metric', 'log', 'topology', 'rule', 'prediction']),
  serverId: z.string().optional(),
  metric: z.string().optional(),
  timeRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  summary: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  threshold: z.number().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
});

const MonitoringBatchFactSeveritySchema = z.enum(['warning', 'critical']);

const MonitoringBatchFactThresholdSchema = z.object({
  warning: z.number(),
  critical: z.number(),
});

const MonitoringBatchFactThresholdsSchema = z.object({
  cpu: MonitoringBatchFactThresholdSchema,
  memory: MonitoringBatchFactThresholdSchema,
  disk: MonitoringBatchFactThresholdSchema,
  network: MonitoringBatchFactThresholdSchema,
});

const MonitoringBatchFactSummarySchema = z.object({
  total: z.number(),
  online: z.number(),
  warning: z.number(),
  critical: z.number(),
  offline: z.number(),
});

const MonitoringBatch24hMetricSummarySchema = z.object({
  metric: z.enum(['cpu', 'memory', 'disk', 'network']),
  unit: z.literal('%'),
  current: z.number(),
  avg24h: z.number(),
  p95: z.number(),
  max: z.number(),
  min: z.number(),
  peakSlot: z.string(),
  currentSlotTimestamp: z.string().optional(),
  peakTimestamp: z.string().optional(),
  windowFrom: z.string().optional(),
  windowTo: z.string().optional(),
  timezone: z.literal('Asia/Seoul').optional(),
  warningSlots: z.number(),
  criticalSlots: z.number(),
  deltaFromAvg: z.number(),
  distanceToWarning: z.number(),
  distanceToCritical: z.number(),
  samples: z.number(),
  slotIntervalMinutes: z.number(),
});

// SSOT parity guard (compile-time). The Zod schema above and the hand-declared
// `MonitoringBatch24hMetricSummary` interface must stay structurally identical;
// `npm run type-check` (CI validate + local gates + git hooks) fails here on any
// field add/remove/type/optionality drift. The remaining Zod-schema ↔ Cloud Run
// engine-output parity is enforced at runtime by the "preserves the complete
// Cloud Run baseline24h contract" test in monitoring-analysis-artifact.test.ts,
// so TS interface ≡ Zod schema ≡ Cloud Run Monitoring24hMetricSummary is
// transitively guaranteed without importing cloud-run into the frontend type graph.
type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const _monitoring24hSummarySchemaParity: IsExact<
  z.infer<typeof MonitoringBatch24hMetricSummarySchema>,
  MonitoringBatch24hMetricSummary
> = true;
void _monitoring24hSummarySchemaParity;

const MonitoringBatchFactCorrelatedLogSchema = z.object({
  evidenceRefId: z.string(),
  severity: MonitoringBatchFactSeveritySchema,
  summary: z.string(),
});

const MonitoringBatchFactSignalSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  serverName: z.string(),
  serverType: z.string(),
  metric: z.enum(['cpu', 'memory', 'disk', 'network']),
  value: z.number(),
  threshold: z.number(),
  thresholdLevel: MonitoringBatchFactSeveritySchema,
  severity: MonitoringBatchFactSeveritySchema,
  evidenceRefId: z.string().optional(),
  baseline24h: MonitoringBatch24hMetricSummarySchema.optional(),
  correlatedLogs: z.array(MonitoringBatchFactCorrelatedLogSchema).optional(),
});

const MonitoringBatchFactPackSchema = z.object({
  factPackVersion: z.string(),
  dataSlot: z.string(),
  sourceMode: z.enum(['replay-json', 'live-otel']),
  queryAsOf: z.string(),
  thresholds: MonitoringBatchFactThresholdsSchema,
  summary: MonitoringBatchFactSummarySchema,
  signals: z.array(MonitoringBatchFactSignalSchema),
  evidenceRefs: z.array(MonitoringBatchFactEvidenceRefSchema),
});

const MonitoringBatchAnalysisResponseSchema = z
  .object({
    success: z.literal(true),
    sourceMode: z.enum(['replay-json', 'live-otel']),
    queryAsOf: z.string(),
    slot: z
      .object({
        slotIndex: z.number(),
        hour: z.number(),
        slotInHour: z.number(),
        minuteOfDay: z.number(),
        timeLabel: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      })
      .passthrough(),
    summary: z.string(),
    servers: z.array(MonitoringBatchServerSchema),
    riskSignals: z.array(MonitoringBatchRiskSignalSchema),
    queryFocusServer: MonitoringBatchQueryFocusServerSchema.optional(),
    evidenceRefs: z.array(MonitoringBatchEvidenceRefSchema),
    dataFreshness: z
      .object({
        generatedAt: z.string().nullable(),
        sourceUpdatedAt: z.string().nullable(),
        stale: z.boolean(),
      })
      .passthrough(),
    _source: z.string().optional(),
  })
  .passthrough()
  .transform((analysis): MonitoringBatchAnalysisResponse => {
    const {
      capacityAlerts: rawCapacityAlerts,
      factPack: rawFactPack,
      ...rest
    } = analysis as typeof analysis & {
      capacityAlerts?: unknown;
      factPack?: unknown;
    };
    const parsedCapacityAlerts = z
      .array(MonitoringBatchCapacityAlertSchema)
      .safeParse(rawCapacityAlerts);
    const parsedFactPack = MonitoringBatchFactPackSchema.safeParse(rawFactPack);

    return {
      ...rest,
      ...(parsedCapacityAlerts.success
        ? { capacityAlerts: parsedCapacityAlerts.data }
        : {}),
      ...(parsedFactPack.success ? { factPack: parsedFactPack.data } : {}),
    } as MonitoringBatchAnalysisResponse;
  });

const ServerMonitoringAnalysisResponseSchema = z
  .object({
    success: z.literal(true),
    serverId: z.string(),
    analysisType: z.enum(['full', 'anomaly', 'trend', 'pattern']),
    timestamp: z.string(),
    _source: z.string().optional(),
  })
  .passthrough()
  .transform(
    (
      analysis
    ): CloudRunAnalysisResponse & {
      _source?: string;
    } => analysis as CloudRunAnalysisResponse & { _source?: string }
  );

export function parseMonitoringBatchAnalysisResponse(
  value: unknown
): MonitoringBatchAnalysisResponse | null {
  const parsed = MonitoringBatchAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseServerMonitoringAnalysisResponse(
  value: unknown
): (CloudRunAnalysisResponse & { _source?: string }) | null {
  const parsed = ServerMonitoringAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
