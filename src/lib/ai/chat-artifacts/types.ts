import type { IncidentReport } from '@/components/ai/pages/auto-report/types';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { MonitoringBatchAnalysisResponse } from '@/types/intelligent-monitoring.types';

export interface ChatArtifactRequest {
  query: string;
  sessionId?: string;
  queryAsOfDataSlot?: JobDataSlot;
  signal?: AbortSignal;
}

export interface IncidentReportArtifact {
  kind: 'incident-report';
  generatedAt: string;
  report: IncidentReport;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface MonitoringAnalysisArtifact {
  kind: 'monitoring-analysis';
  generatedAt: string;
  title: string;
  summary: string;
  serverCount: number;
  riskSignalCount: number;
  warningServers: number;
  criticalServers: number;
  analysis: MonitoringBatchAnalysisResponse;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface ServerSnapshotArtifact {
  kind: 'server-snapshot';
  generatedAt: string;
  title: string;
  summary: string;
  source: 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  slot: JobDataSlot;
  totals: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  averages: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  topServers: Array<{
    id: string;
    name: string;
    status: 'online' | 'warning' | 'critical' | 'offline';
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    primaryRisk: 'cpu' | 'memory' | 'disk' | 'network';
  }>;
  alerts: Array<{
    serverId: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    value: number;
    severity: 'warning' | 'critical';
    summary: string;
  }>;
}

export type ChatArtifact =
  | IncidentReportArtifact
  | MonitoringAnalysisArtifact
  | ServerSnapshotArtifact;
