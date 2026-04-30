/**
 * 🧠 Intelligent Monitoring 관련 타입 정의
 * Cloud Run API 응답 타입 및 다중 서버 분석 타입
 */

// ============================================================================
// Cloud Run API Response Types (v5.84+)
// These types match the actual response from /api/ai/analyze-server
// ============================================================================

/** 메트릭별 이상 탐지 결과 */
export interface MetricAnomalyResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  currentValue: number;
  threshold: {
    upper: number;
    lower: number;
  };
}

/** 이상 탐지 API 응답 */
export interface CloudRunAnomalyDetection {
  success: boolean;
  serverId: string;
  serverName: string;
  anomalyCount: number;
  hasAnomalies: boolean;
  results: Record<string, MetricAnomalyResult>;
  timestamp: string;
  _algorithm: string;
  _engine: string;
  _cached: boolean;
}

/** 메트릭별 트렌드 예측 결과 */
export interface MetricTrendResult {
  trend: 'increasing' | 'decreasing' | 'stable';
  currentValue: number;
  predictedValue: number;
  changePercent: number;
  confidence: number;
  currentStatus?: 'online' | 'warning' | 'critical';
  thresholdBreach?: {
    willBreachWarning: boolean;
    timeToWarning: number | null;
    willBreachCritical: boolean;
    timeToCritical: number | null;
    humanReadable: string;
  };
  recovery?: {
    willRecover: boolean;
    timeToRecovery: number | null;
    humanReadable: string | null;
  };
}

/** 트렌드 예측 API 응답 */
export interface CloudRunTrendPrediction {
  success: boolean;
  serverId: string;
  serverName: string;
  predictionHorizon: string;
  results: Record<string, MetricTrendResult>;
  summary: {
    increasingMetrics: string[];
    hasRisingTrends: boolean;
  };
  timestamp: string;
  _algorithm: string;
  _engine: string;
  _cached: boolean;
}

/** 패턴 분석 결과 항목 */
export interface PatternAnalysisItem {
  pattern: string;
  confidence: number;
  insights: string;
}

/** 패턴 분석 API 응답 */
export interface CloudRunPatternAnalysis {
  success: boolean;
  patterns: string[];
  detectedIntent: string;
  analysisResults: PatternAnalysisItem[];
  _mode: string;
}

/** Cloud Run analyze-server 전체 응답 */
export interface CloudRunAnalysisResponse {
  success: boolean;
  serverId: string;
  analysisType: 'full' | 'anomaly' | 'trend' | 'pattern';
  timestamp: string;
  anomalyDetection?: CloudRunAnomalyDetection;
  trendPrediction?: CloudRunTrendPrediction;
  patternAnalysis?: CloudRunPatternAnalysis;
}

// ============================================================================
// Multi-Server Analysis Types (v5.85+)
// 전체 서버 개별 분석 + 종합 요약 지원
// ============================================================================

/** 개별 서버 분석 결과 */
export interface ServerAnalysisResult extends CloudRunAnalysisResponse {
  serverName: string;
  overallStatus: 'online' | 'warning' | 'critical';
}

/** 전체 서버 종합 요약 */
export interface SystemAnalysisSummary {
  totalServers: number;
  healthyServers: number;
  warningServers: number;
  criticalServers: number;
  overallStatus: 'online' | 'warning' | 'critical';
  topIssues: Array<{
    serverId: string;
    serverName: string;
    metric: string;
    severity: 'low' | 'medium' | 'high';
    currentValue: number;
    confidence?: number;
    threshold?: {
      upper: number;
      lower: number;
    };
    reason?: string;
    recommendation?: string;
  }>;
  predictions: Array<{
    serverId: string;
    serverName: string;
    metric: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    currentValue: number;
    predictedValue: number | null;
    predictionState?: 'available' | 'missing';
    changePercent: number;
    confidence?: number;
    thresholdBreachMessage?: string;
  }>;
}

// ============================================================================
// Monitoring Snapshot Batch Types (Cloud Run /monitoring/analyze-batch)
// ============================================================================

export interface MonitoringBatchServer {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface MonitoringBatchRiskSignal {
  id: string;
  serverId: string;
  serverName: string;
  serverType: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  trend: 'up' | 'down' | 'stable';
  severity: 'warning' | 'critical';
  evidenceRefId: string;
}

export interface MonitoringBatchEvidenceRef {
  id: string;
  kind: 'metric' | 'log' | 'topology' | 'rule' | 'prediction';
  serverId?: string;
  metric?: string;
  timeRange: { from: string; to: string };
  summary: string;
  value?: number | string;
  threshold?: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface MonitoringBatchAnalysisResponse {
  success: boolean;
  sourceMode: 'replay-json' | 'live-otel';
  queryAsOf: string;
  slot: {
    slotIndex: number;
    hour: number;
    slotInHour: number;
    minuteOfDay: number;
    timeLabel: string;
    startTime: string;
    endTime: string;
  };
  summary: string;
  servers: MonitoringBatchServer[];
  riskSignals: MonitoringBatchRiskSignal[];
  evidenceRefs: MonitoringBatchEvidenceRef[];
  dataFreshness: {
    generatedAt: string | null;
    sourceUpdatedAt: string | null;
    stale: boolean;
  };
  _source?: string;
}

/** 다중 서버 분석 응답 (전체 시스템 분석 시) */
export interface MultiServerAnalysisResponse {
  success: boolean;
  isMultiServer: true;
  timestamp: string;
  servers: ServerAnalysisResult[];
  summary: SystemAnalysisSummary;
}

/** 단일/다중 서버 분석 응답 유니온 타입 */
export type AnalysisResponse =
  | CloudRunAnalysisResponse
  | MultiServerAnalysisResponse;

/** 다중 서버 응답인지 확인하는 타입 가드 */
export function isMultiServerResponse(
  response: AnalysisResponse
): response is MultiServerAnalysisResponse {
  return 'isMultiServer' in response && response.isMultiServer === true;
}
