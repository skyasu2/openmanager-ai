import type {
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  OpsProcedureArtifact,
  ServerMonitoringAnalysisArtifact,
} from './artifact-types';

export type {
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  MonitoringRoleGroupSummary,
  OpsProcedureArtifact,
  ServerMonitoringAnalysisArtifact,
  ServerMonitoringArtifactRequest,
  ServerMonitoringCurrentMetrics,
} from './artifact-types';

export const MONITORING_ROUTE_DECISION_ARTIFACT_KINDS = [
  'incident-report',
  'monitoring-analysis',
  'server-monitoring-analysis',
  'ops-procedure',
] as const;

export type MonitoringRouteDecisionArtifactKind =
  (typeof MONITORING_ROUTE_DECISION_ARTIFACT_KINDS)[number];

export type MonitoringChatArtifact =
  | IncidentReportArtifact
  | MonitoringAnalysisArtifact
  | ServerMonitoringAnalysisArtifact
  | OpsProcedureArtifact;
