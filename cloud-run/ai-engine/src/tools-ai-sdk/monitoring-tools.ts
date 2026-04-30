import { tool } from 'ai';
import { z } from 'zod';

import { createMonitoringDataSource } from '../services/monitoring/monitoring-data-source';

const QueryAsOfSchema = z
  .object({
    createdAt: z.string(),
    source: z.literal('vercel-static-otel'),
    datasetVersion: z.literal('24h-rotating-v1.0.0'),
    dataSlot: z.object({
      slotIndex: z.number().int().min(0).max(143),
      minuteOfDay: z.number().int().min(0).max(1430),
      timeLabel: z.string(),
    }),
  })
  .optional();

const SourceModeSchema = z.enum(['replay-json', 'live-otel']).optional();

function getSource(sourceMode?: 'replay-json' | 'live-otel') {
  return createMonitoringDataSource({ mode: sourceMode });
}

export const getMonitoringSnapshot = tool({
  description:
    '공통 서버 모니터링 스냅샷을 조회합니다. Chat, Analyst, Reporter가 같은 queryAsOf/sourceMode/evidenceRefs 계약으로 현재 상태를 확인할 때 사용합니다.',
  inputSchema: z.object({
    sourceMode: SourceModeSchema,
    queryAsOf: QueryAsOfSchema,
  }),
  execute: async ({ sourceMode, queryAsOf }) =>
    getSource(sourceMode).getSnapshot({ queryAsOf }),
});

export const getMetricSeries = tool({
  description:
    '특정 서버의 CPU/Memory/Disk/Network 시계열을 조회합니다. 추세 근거가 필요할 때 사용합니다.',
  inputSchema: z.object({
    sourceMode: SourceModeSchema,
    queryAsOf: QueryAsOfSchema,
    serverId: z.string().min(1),
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    points: z.number().int().min(1).max(144).optional(),
  }),
  execute: async ({ sourceMode, queryAsOf, serverId, metric, points }) =>
    getSource(sourceMode).getMetricSeries({
      queryAsOf,
      serverId,
      metric,
      points,
    }),
});

export const getRelatedLogs = tool({
  description:
    '서버/시간 범위별 관련 로그를 조회하고 monitoring evidenceRefs로 반환합니다.',
  inputSchema: z.object({
    sourceMode: SourceModeSchema,
    queryAsOf: QueryAsOfSchema,
    serverId: z.string().min(1).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  execute: async ({ sourceMode, queryAsOf, serverId, from, to, severity, limit }) =>
    getSource(sourceMode).getRelatedLogs({
      queryAsOf,
      serverId,
      from,
      to,
      severity,
      limit,
    }),
});

export const rankRiskSignals = tool({
  description:
    '현재 monitoring snapshot에서 위험 신호를 severity/value 기준으로 정렬해 반환합니다.',
  inputSchema: z.object({
    sourceMode: SourceModeSchema,
    queryAsOf: QueryAsOfSchema,
    scope: z.enum(['all', 'warning', 'critical']).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  execute: async ({ sourceMode, queryAsOf, scope, limit }) =>
    getSource(sourceMode).rankRiskSignals({
      queryAsOf,
      scope,
      limit,
    }),
});

export const buildMonitoringIncidentTimeline = tool({
  description:
    'MonitoringSnapshot과 관련 로그를 이용해 Reporter용 장애 타임라인과 evidenceRefs를 구성합니다.',
  inputSchema: z.object({
    sourceMode: SourceModeSchema,
    queryAsOf: QueryAsOfSchema,
    serverId: z.string().min(1).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  execute: async ({ sourceMode, queryAsOf, serverId, from, to, limit }) =>
    getSource(sourceMode).buildIncidentTimeline({
      queryAsOf,
      serverId,
      from,
      to,
      limit,
    }),
});

export const monitoringTools = {
  getMonitoringSnapshot,
  getMetricSeries,
  getRelatedLogs,
  rankRiskSignals,
  buildMonitoringIncidentTimeline,
};
