/**
 * Analysis Result Types
 *
 * Shared type definitions for anomaly detection and analysis tools.
 * Used by analyst-tools.ts for type-safe responses.
 *
 * @version 1.0.0
 * @created 2026-01-25
 */

// ============================================================================
// 1. System Summary Types
// ============================================================================

/**
 * Summary of server health across the system
 */
export interface SystemSummary {
  totalServers: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
}

// ============================================================================
// 2. Anomaly Detection Types
// ============================================================================

/**
 * Individual anomaly item for a single server-metric pair
 */
export interface ServerAnomalyItem {
  server_id: string;
  server_name: string;
  metric: string;
  value: number;
  severity: 'warning' | 'critical';
}

export interface ForecastBreachItem {
  serverId: string;
  serverName: string;
  metric: 'cpu' | 'memory' | 'disk';
  currentValue: number;
  predictedValue1h: number;
  warningThreshold: number;
  riskLevel: 'medium' | 'high';
}

/**
 * Result type for detectAnomaliesAllServers tool
 */
export interface DetectAnomaliesAllServersResult {
  success: true;
  totalServers: number;
  anomalies: ServerAnomalyItem[];
  affectedServers: string[];
  summary: SystemSummary;
  hasAnomalies: boolean;
  anomalyCount: number;
  timestamp: string;
  algorithmVersion: string;
  decisionSource: string;
  confidenceBasis: string;
  riskForecast: {
    horizonHours: number;
    model: string;
    breachCount: number;
    predictedBreaches: ForecastBreachItem[];
  };
  _algorithm: string;
}

/**
 * Error result type for detectAnomaliesAllServers tool
 */
export interface DetectAnomaliesAllServersError {
  success: false;
  error: string;
}

/**
 * Union type for detectAnomaliesAllServers return
 */
export type DetectAnomaliesAllServersResponse =
  | DetectAnomaliesAllServersResult
  | DetectAnomaliesAllServersError;

// ============================================================================
// 3. Single Server Anomaly Types
// ============================================================================

/**
 * Anomaly result for a single metric
 */
export interface AnomalyResultItem {
  isAnomaly: boolean;
  severity: string;
  confidence: number;
  currentValue: number;
  threshold: {
    upper: number;
    lower: number;
  };
  thresholdExceeded?: boolean;
}

/**
 * Result type for detectAnomalies (single server) tool
 */
export interface DetectAnomaliesResult {
  success: true;
  serverId: string;
  serverName: string;
  status: 'online' | 'warning' | 'critical';
  anomalyCount: number;
  hasAnomalies: boolean;
  results: Record<string, AnomalyResultItem>;
  summaryMessage: string;
  summary: SystemSummary;
  timestamp: string;
  _algorithm: string;
}

/**
 * Error result type for detectAnomalies tool
 */
export interface DetectAnomaliesError {
  success: false;
  error: string;
}

/**
 * Union type for detectAnomalies return
 */
export type DetectAnomaliesResponse = DetectAnomaliesResult | DetectAnomaliesError;
