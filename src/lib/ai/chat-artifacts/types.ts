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

export type ChatArtifact = IncidentReportArtifact | MonitoringAnalysisArtifact;
