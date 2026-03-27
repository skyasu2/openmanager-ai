/**
 * Anomaly data structure from Analyst Agent
 */
export interface AnomalyData {
  serverId: string;
  serverName: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  detectedAt: string;
  description?: string;
}

/**
 * Root cause analysis result from Reporter/Analyst Agent
 */
export interface RootCauseData {
  cause: string;
  confidence: number;
  evidence: string[];
  suggestedFix: string;
  analyzedAt: string;
}

/**
 * Metric snapshot for context sharing
 */
export interface MetricSnapshot {
  serverId: string;
  serverName: string;
  cpu: number;
  memory: number;
  disk: number;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

/**
 * Handoff event tracking
 */
export interface HandoffEvent {
  from: string;
  to: string;
  reason?: string;
  timestamp: string;
  context?: string;
}

/**
 * Structured findings from all agents
 */
export interface AgentFindings {
  anomalies: AnomalyData[];
  rootCause: RootCauseData | null;
  affectedServers: string[];
  metrics: MetricSnapshot[];
  knowledgeResults: string[];
  recommendedCommands: string[];
}

/**
 * Complete session context
 */
export interface AgentContext {
  sessionId: string;
  findings: AgentFindings;
  lastAgent: string;
  handoffs: HandoffEvent[];
  query: string;
  createdAt: string;
  updatedAt: string;
}
