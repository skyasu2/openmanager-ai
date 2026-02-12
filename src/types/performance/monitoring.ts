/**
 * Performance Monitoring Types
 * Independent module developed in parallel with Claude
 */

export interface PerformanceMetric {
  timestamp: number;
  cpu: number;
  memory: number;
  responseTime: number;
  activeConnections: number;
  errorRate: number;
}

export interface SystemHealth {
  status: 'online' | 'warning' | 'critical';
  score: number;
  lastUpdate: number;
}

export interface AlertConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  responseTimeThreshold: number;
  errorRateThreshold: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  type: 'cpu' | 'memory' | 'response-time' | 'error-rate';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceData {
  current: PerformanceMetric;
  history: PerformanceMetric[];
  health: SystemHealth;
  alerts: Alert[];
}

export interface WebSocketPerformanceMessage {
  type: 'performance-update' | 'alert' | 'health-check';
  data: PerformanceMetric | Alert | SystemHealth;
  timestamp: number;
}

export interface ChartDataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'doughnut';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
      tension?: number;
    }[];
  };
  options: {
    responsive: boolean;
    maintainAspectRatio: boolean;
    scales?: unknown;
    plugins?: unknown;
  };
}
