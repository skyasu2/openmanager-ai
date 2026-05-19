import type {
  MonitoringEvidenceRef,
  MonitoringIncidentTimeline,
} from '../services/monitoring/monitoring-types';

export interface ToolBasedData {
  id: string;
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  affectedServers: Array<{
    id: string;
    name: string;
    severity: string;
    metric?: string;
    value?: number;
  }>;
  anomalies: Array<{
    server_id: string;
    server_name: string;
    metric: string;
    value: number;
    severity: string;
  }>;
  system_summary: {
    total_servers: number;
    online_servers: number;
    warning_servers: number;
    critical_servers: number;
  };
  timeline: Array<{ timestamp: string; event: string; severity: string }>;
  recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  pattern: string;
  postmortem: {
    timeline: string[];
    hypotheses: string[];
    prevention: string[];
  };
}

export type IncidentRecommendation = ToolBasedData['recommendations'][number];

export type IncidentReportFallback = Pick<
  ToolBasedData,
  | 'title'
  | 'severity'
  | 'affected_servers'
  | 'affectedServers'
  | 'recommendations'
  | 'pattern'
  | 'postmortem'
>;

export interface NormalizedIncidentReportOutput {
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  affectedServers: ToolBasedData['affectedServers'];
  root_cause: string;
  recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  pattern: string;
  postmortem: ToolBasedData['postmortem'];
}

export interface MonitoringGroundingForReport {
  evidenceRefs?: MonitoringEvidenceRef[];
  timeline?: MonitoringIncidentTimeline | null;
}
