export const MONITORING_ROUTE_DECISION_ARTIFACT_KINDS = [
  'server-snapshot',
  'incident-report',
  'monitoring-analysis',
] as const;

export type MonitoringRouteDecisionArtifactKind =
  (typeof MONITORING_ROUTE_DECISION_ARTIFACT_KINDS)[number];
