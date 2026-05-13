import type { AgentToolName } from './agent-runtime-policy';
import { getAgentToolAllowlist } from './agent-runtime-policy';

export type MonitoringToolIntent =
  | 'anomaly'
  | 'prediction'
  | 'math'
  | 'rca'
  | 'advisor'
  | 'serverGroup'
  | 'logs'
  | 'metrics'
  | 'formattingOnly'
  | 'general'
  | 'metricRanking'
  | 'realtimeMetric'
  | 'webOnly';

export type MonitoringToolChoice =
  | 'auto'
  | 'required'
  | { type: 'tool'; toolName: AgentToolName };

export interface MonitoringToolPolicy {
  ownerAgent?: string;
  activeTools: readonly AgentToolName[];
  toolChoice: MonitoringToolChoice;
}

export interface ResolvedMonitoringToolPolicy {
  ownerAgent?: string;
  activeTools: AgentToolName[];
  toolChoice: MonitoringToolChoice;
}

export const MONITORING_INTENT_TOOL_POLICIES = {
  anomaly: {
    ownerAgent: 'Analyst Agent',
    activeTools: [
      'detectAnomalies',
      'predictTrends',
      'analyzePattern',
      'getServerMetrics',
      'finalAnswer',
    ],
    toolChoice: 'required',
  },
  prediction: {
    ownerAgent: 'Analyst Agent',
    activeTools: [
      'predictTrends',
      'analyzePattern',
      'detectAnomalies',
      'correlateMetrics',
      'estimateCapacityProjection',
      'finalAnswer',
    ],
    toolChoice: 'required',
  },
  math: {
    ownerAgent: 'Metrics Query Agent',
    activeTools: [
      'evaluateMathExpression',
      'computeSeriesStats',
      'estimateCapacityProjection',
      'finalAnswer',
    ],
    toolChoice: 'required',
  },
  rca: {
    ownerAgent: 'Analyst Agent',
    activeTools: [
      'findRootCause',
      'buildIncidentTimeline',
      'correlateMetrics',
      'getServerMetrics',
      'detectAnomalies',
      'finalAnswer',
    ],
    toolChoice: 'required',
  },
  advisor: {
    ownerAgent: 'Advisor Agent',
    activeTools: ['recommendCommands', 'finalAnswer'],
    toolChoice: 'required',
  },
  serverGroup: {
    ownerAgent: 'Metrics Query Agent',
    activeTools: [
      'getServerByGroup',
      'getServerByGroupAdvanced',
      'filterServers',
      'finalAnswer',
    ],
    toolChoice: 'auto',
  },
  logs: {
    activeTools: [
      'getServerLogs',
      'getServerMetrics',
      'filterServers',
      'finalAnswer',
    ],
    toolChoice: 'required',
  },
  metrics: {
    ownerAgent: 'Metrics Query Agent',
    activeTools: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'getServerByGroup',
      'finalAnswer',
    ],
    toolChoice: 'auto',
  },
  formattingOnly: {
    activeTools: ['finalAnswer'],
    toolChoice: 'required',
  },
  general: {
    activeTools: ['finalAnswer'],
    toolChoice: 'required',
  },
  metricRanking: {
    ownerAgent: 'Metrics Query Agent',
    activeTools: ['getServerMetricsAdvanced', 'finalAnswer'],
    toolChoice: {
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    },
  },
  realtimeMetric: {
    ownerAgent: 'Metrics Query Agent',
    activeTools: ['getServerMetrics', 'finalAnswer'],
    toolChoice: {
      type: 'tool',
      toolName: 'getServerMetrics',
    },
  },
  webOnly: {
    activeTools: ['searchWeb', 'finalAnswer'],
    toolChoice: {
      type: 'tool',
      toolName: 'searchWeb',
    },
  },
} as const satisfies Record<MonitoringToolIntent, MonitoringToolPolicy>;

export function resolveMonitoringToolPolicy(
  intent: MonitoringToolIntent
): ResolvedMonitoringToolPolicy {
  const policy = MONITORING_INTENT_TOOL_POLICIES[intent];

  return {
    ...policy,
    activeTools: [...policy.activeTools],
  };
}

export function getMonitoringIntentOwnerAgent(
  intent: MonitoringToolIntent
): string | undefined {
  const policy = MONITORING_INTENT_TOOL_POLICIES[intent];
  return 'ownerAgent' in policy ? policy.ownerAgent : undefined;
}

export function getMonitoringIntentTools(
  intent: MonitoringToolIntent
): AgentToolName[] {
  return [...MONITORING_INTENT_TOOL_POLICIES[intent].activeTools];
}

export function getUncoveredMonitoringIntentTools(
  intent: MonitoringToolIntent
): AgentToolName[] {
  const ownerAgent = getMonitoringIntentOwnerAgent(intent);
  if (!ownerAgent) {
    return [];
  }

  const allowlist = new Set(getAgentToolAllowlist(ownerAgent));
  return getMonitoringIntentTools(intent).filter(
    (toolName) => !allowlist.has(toolName)
  );
}
