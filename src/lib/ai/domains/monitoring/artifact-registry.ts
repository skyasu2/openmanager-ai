import type {
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  OpsProcedureArtifact,
  ServerMonitoringAnalysisArtifact,
} from '@/lib/ai/chat-artifacts/types';

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
