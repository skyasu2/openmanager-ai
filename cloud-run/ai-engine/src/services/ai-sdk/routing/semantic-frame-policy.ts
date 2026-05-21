import type { DomainIntentFrame } from '../../../core/assistant-runtime';
import {
  MONITORING_ANOMALY_DETECTION_CAPABILITY_ID,
  MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID,
  MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
  MONITORING_DOMAIN_ID,
  MONITORING_FAILURE_RISK_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from '../../../domains/monitoring/constants';

export type MonitoringSemanticCategory =
  | 'anomaly'
  | 'advisor'
  | 'logs'
  | 'metrics'
  | 'prediction'
  | 'rca'
  | 'server_health';

export interface MonitoringSemanticRoute {
  agentName: 'Advisor Agent' | 'Analyst Agent' | 'Metrics Query Agent' | 'Reporter Agent';
  category: MonitoringSemanticCategory;
}

const MONITORING_INCIDENT_REPORT_CAPABILITY_ID = 'monitoring.incident_report';
const MONITORING_LOG_ANALYSIS_CAPABILITY_ID = 'monitoring.log_analysis';
const MONITORING_METRIC_CURRENT_CAPABILITY_ID = 'monitoring.metric_current';
const MONITORING_METRIC_TREND_CAPABILITY_ID = 'monitoring.metric_trend';
const MONITORING_OPS_ADVICE_CAPABILITY_ID = 'monitoring.ops_advice';
const MONITORING_ROOT_CAUSE_CAPABILITY_ID = 'monitoring.root_cause';

const MONITORING_ROUTE_BY_CAPABILITY = new Map<string, MonitoringSemanticRoute>([
  [
    MONITORING_ANOMALY_DETECTION_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'anomaly' },
  ],
  [
    MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'prediction' },
  ],
  [
    MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'prediction' },
  ],
  [
    MONITORING_FAILURE_RISK_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'anomaly' },
  ],
  [
    MONITORING_INCIDENT_REPORT_CAPABILITY_ID,
    { agentName: 'Reporter Agent', category: 'rca' },
  ],
  [
    MONITORING_LOG_ANALYSIS_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'logs' },
  ],
  [
    MONITORING_METRIC_CURRENT_CAPABILITY_ID,
    { agentName: 'Metrics Query Agent', category: 'metrics' },
  ],
  [
    MONITORING_METRIC_RANKING_CAPABILITY_ID,
    { agentName: 'Metrics Query Agent', category: 'metrics' },
  ],
  [
    MONITORING_METRIC_TREND_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'prediction' },
  ],
  [
    MONITORING_OPS_ADVICE_CAPABILITY_ID,
    { agentName: 'Advisor Agent', category: 'advisor' },
  ],
  [
    MONITORING_PEAK_METRIC_CAPABILITY_ID,
    { agentName: 'Metrics Query Agent', category: 'metrics' },
  ],
  [
    MONITORING_ROOT_CAUSE_CAPABILITY_ID,
    { agentName: 'Analyst Agent', category: 'rca' },
  ],
  [
    MONITORING_SERVER_HEALTH_CAPABILITY_ID,
    { agentName: 'Metrics Query Agent', category: 'server_health' },
  ],
]);

const MONITORING_INTENTS_BY_CAPABILITY = new Map<string, ReadonlySet<string>>([
  [MONITORING_ANOMALY_DETECTION_CAPABILITY_ID, new Set(['anomaly_detection'])],
  [MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID, new Set(['anomaly_prediction'])],
  [MONITORING_CAPACITY_FORECAST_CAPABILITY_ID, new Set(['capacity_forecast'])],
  [MONITORING_FAILURE_RISK_CAPABILITY_ID, new Set(['failure_risk'])],
  [MONITORING_INCIDENT_REPORT_CAPABILITY_ID, new Set(['incident_report'])],
  [MONITORING_LOG_ANALYSIS_CAPABILITY_ID, new Set(['log_analysis'])],
  [MONITORING_METRIC_CURRENT_CAPABILITY_ID, new Set(['metric_current'])],
  [
    MONITORING_METRIC_RANKING_CAPABILITY_ID,
    new Set(['metric_current', 'metric_ranking']),
  ],
  [MONITORING_METRIC_TREND_CAPABILITY_ID, new Set(['metric_trend'])],
  [MONITORING_OPS_ADVICE_CAPABILITY_ID, new Set(['ops_advice'])],
  [MONITORING_PEAK_METRIC_CAPABILITY_ID, new Set(['metric_peak'])],
  [MONITORING_ROOT_CAUSE_CAPABILITY_ID, new Set(['root_cause'])],
  [MONITORING_SERVER_HEALTH_CAPABILITY_ID, new Set(['server_health'])],
]);

const MONITORING_ROUTE_BY_INTENT = new Map<string, MonitoringSemanticRoute>(
  Array.from(MONITORING_INTENTS_BY_CAPABILITY.entries()).flatMap(
    ([capabilityId, intents]) => {
      const route = MONITORING_ROUTE_BY_CAPABILITY.get(capabilityId);
      if (!route) return [];
      return Array.from(intents, (intent) => [intent, route]);
    }
  )
);

function normalizeSemanticKey(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function resolveMonitoringSemanticFrameRoute(
  intentFrame: Pick<DomainIntentFrame, 'capabilityId' | 'intent'>
): MonitoringSemanticRoute | undefined {
  const intent = normalizeSemanticKey(intentFrame.intent);
  if (!intent) return undefined;

  const capabilityId = normalizeSemanticKey(intentFrame.capabilityId);
  if (!capabilityId) {
    return MONITORING_ROUTE_BY_INTENT.get(intent);
  }

  const validIntents = MONITORING_INTENTS_BY_CAPABILITY.get(capabilityId);
  if (!validIntents?.has(intent)) return undefined;

  return MONITORING_ROUTE_BY_CAPABILITY.get(capabilityId);
}

export function isValidMonitoringSemanticFrameReference(
  intentFrame: Pick<DomainIntentFrame, 'capabilityId' | 'domainId' | 'intent'>
): boolean {
  const domainId = normalizeSemanticKey(intentFrame.domainId);
  const capabilityId = normalizeSemanticKey(intentFrame.capabilityId);
  const isMonitoringDomain = domainId === MONITORING_DOMAIN_ID;
  const hasMonitoringCapability = capabilityId?.startsWith('monitoring.') === true;

  if (!isMonitoringDomain && !hasMonitoringCapability) return true;
  if (!isMonitoringDomain || (capabilityId && !hasMonitoringCapability)) {
    return false;
  }

  return resolveMonitoringSemanticFrameRoute(intentFrame) !== undefined;
}
