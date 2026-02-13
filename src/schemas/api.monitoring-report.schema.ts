import * as z from 'zod';

export const MonitoringAlertSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  instance: z.string(),
  labels: z.record(z.string(), z.string()),
  metric: z.string(),
  value: z.number(),
  threshold: z.number(),
  severity: z.enum(['warning', 'critical']),
  state: z.enum(['firing', 'resolved']),
  firedAt: z.string(),
  resolvedAt: z.string().optional(),
  duration: z.number(),
});

const ServerTypeStatsSchema = z.object({
  serverType: z.string(),
  count: z.number(),
  avgCpu: z.number(),
  avgMemory: z.number(),
  avgDisk: z.number(),
  avgNetwork: z.number(),
  maxCpu: z.number(),
  maxMemory: z.number(),
  onlineCount: z.number(),
  warningCount: z.number(),
  criticalCount: z.number(),
});

const TopServerSchema = z.object({
  serverId: z.string(),
  instance: z.string(),
  serverType: z.string(),
  value: z.number(),
});

export const MonitoringReportResponseSchema = z.object({
  success: z.literal(true),
  timestamp: z.string(),
  health: z.object({
    score: z.number(),
    grade: z.enum(['A', 'B', 'C', 'D', 'F']),
    penalties: z.object({
      criticalAlerts: z.number(),
      warningAlerts: z.number(),
      highCpuAvg: z.number(),
      highMemoryAvg: z.number(),
      highDiskAvg: z.number(),
      longFiringAlerts: z.number(),
    }),
  }),
  aggregated: z.object({
    statusCounts: z.object({
      total: z.number(),
      online: z.number(),
      warning: z.number(),
      critical: z.number(),
      offline: z.number(),
    }),
    byServerType: z.array(ServerTypeStatsSchema),
    topCpu: z.array(TopServerSchema),
    topMemory: z.array(TopServerSchema),
    avgCpu: z.number(),
    avgMemory: z.number(),
    avgDisk: z.number(),
    avgNetwork: z.number(),
  }),
  firingAlerts: z.array(MonitoringAlertSchema),
  resolvedAlerts: z.array(MonitoringAlertSchema).default([]),
  metadata: z.object({
    dataSource: z.string(),
    processingTime: z.number(),
  }),
});

export const MonitoringReportErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  code: z.enum([
    'MONITORING_REPORT_FAILED',
    'MONITORING_CONTEXT_ERROR',
    'MONITORING_RESPONSE_INVALID',
    'MONITORING_DATA_SOURCE_TIMEOUT',
  ]),
});

export const MonitoringReportApiResponseSchema = z.union([
  MonitoringReportResponseSchema,
  MonitoringReportErrorResponseSchema,
]);

export type MonitoringReportResponse = z.infer<
  typeof MonitoringReportResponseSchema
>;
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>;
export type MonitoringReportErrorResponse = z.infer<
  typeof MonitoringReportErrorResponseSchema
>;
export type MonitoringReportErrorCode = MonitoringReportErrorResponse['code'];
export type MonitoringReportApiResponse = z.infer<
  typeof MonitoringReportApiResponseSchema
>;
