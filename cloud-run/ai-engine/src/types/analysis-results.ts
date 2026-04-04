/**
 * 🎯 Analysis Results Types
 * 
 * Shared types for anomaly detection, trends, and forecasting.
 * 
 * @version 2.1.0
 */

// ============================================================================
// 1. System Summary Types
// ============================================================================

/**
 * Summary of server health across the system
 */
export interface SystemSummary {
  totalServers: number;
  onlineCount: number;
  warningCount: number;
  criticalCount: number;
  offlineCount?: number;
}

export interface AnalysisSummary {
  totalServers: number;
  onlineCount: number;
  warningCount: number;
  criticalCount: number;
  offlineCount?: number;
}

// ============================================================================
// 2. Anomaly Detection Types
// ============================================================================

export interface ServerAnomalyItem {
  server_id: string;
  server_name: string;
  metric: string;
  value: number;
  severity: 'warning' | 'critical';
}

export interface AnomalyDetectionResult {
  success: boolean;
  totalServers: number;
  anomalies: ServerAnomalyItem[];
  affectedServers: string[];
  summary: SystemSummary;
  hasAnomalies: boolean;
  anomalyCount: number;
  timestamp: string;
  error?: string;
  systemMessage?: string;
}

// ============================================================================
// 3. Forecasting Types
// ============================================================================

export interface ForecastBreachItem {
  serverId: string;
  serverName: string;
  metric: string;
  currentValue: number;
  predictedValue1h: number;
  warningThreshold: number;
  riskLevel: 'medium' | 'high';
}

export interface RiskForecast {
  horizonHours: number;
  model: string;
  breachCount: number;
  predictedBreaches: ForecastBreachItem[];
}

export interface ForecastResult extends AnomalyDetectionResult {
  riskForecast: RiskForecast;
}
