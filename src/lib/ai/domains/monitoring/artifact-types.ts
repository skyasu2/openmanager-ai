import type { IncidentReport } from '@/components/ai/pages/auto-report/types';
import type {
  ArtifactContractMetadata,
  ArtifactEvidence,
  ChatArtifactRequest,
} from '@/lib/ai/chat-artifacts/types';
import type { JobDataSlot } from '@/types/ai-jobs';
import type {
  CloudRunAnalysisResponse,
  MonitoringBatchAnalysisResponse,
  MonitoringBatchCapacityAlert,
  MonitoringBatchQueryFocusServer,
  ServerAnalysisResult,
} from '@/types/intelligent-monitoring.types';

export interface IncidentReportArtifact extends ArtifactContractMetadata {
  kind: 'incident-report';
  generatedAt: string;
  report: IncidentReport;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface MonitoringAnalysisArtifact extends ArtifactContractMetadata {
  kind: 'monitoring-analysis';
  generatedAt: string;
  title: string;
  summary: string;
  serverCount: number;
  riskSignalCount: number;
  warningServers: number;
  criticalServers: number;
  analysis: MonitoringBatchAnalysisResponse;
  queryFocusServer?: MonitoringBatchQueryFocusServer;
  capacityAlerts?: MonitoringBatchCapacityAlert[];
  roleGroupSummary?: MonitoringRoleGroupSummary[];
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface MonitoringRoleGroupSummary {
  role: string;
  count: number;
  warningCount: number;
  criticalCount: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
}

export interface ServerMonitoringCurrentMetrics {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  load1?: number;
  load5?: number;
  cpuCores?: number;
}

export interface ServerMonitoringArtifactRequest extends ChatArtifactRequest {
  serverId: string;
  serverName: string;
  currentMetrics?: ServerMonitoringCurrentMetrics;
}

export interface ServerMonitoringAnalysisArtifact
  extends ArtifactContractMetadata {
  kind: 'server-monitoring-analysis';
  generatedAt: string;
  title: string;
  summary: string;
  serverId: string;
  serverName: string;
  overallStatus: ServerAnalysisResult['overallStatus'];
  analysis: CloudRunAnalysisResponse;
  server: ServerAnalysisResult;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface OpsProcedureArtifact extends ArtifactContractMetadata {
  kind: 'ops-procedure';
  generatedAt: string;
  title: string;
  summary: string;
  procedureType: 'runbook' | 'alert-rule' | 'script';
  source: 'tool-result' | 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  inputs: {
    metric?: 'cpu' | 'memory' | 'disk' | 'network';
    threshold?: number;
    serverScope?: 'all' | 'group' | 'server';
    serverId?: string;
    group?: string;
    timeWindowMinutes?: number;
    notificationTarget?: 'slack-webhook' | 'none';
  };
  evidence: ArtifactEvidence[];
  runbook: {
    symptoms: string[];
    likelyCauses: string[];
    responseSteps: string[];
    validationSteps: string[];
    rollbackOrStopConditions: string[];
    limitations: string[];
  };
  codeBlocks: Array<{
    id: string;
    title: string;
    language: 'bash' | 'yaml' | 'promql' | 'markdown';
    content: string;
    executable: boolean;
    requiredEnv: string[];
    safetyLevel: 'read-only' | 'notification-only' | 'mutating';
    notes: string[];
  }>;
  validation: {
    noFakeFunctions: boolean;
    noHardcodedSecrets: boolean;
    requiresManualReview: boolean;
  };
}
