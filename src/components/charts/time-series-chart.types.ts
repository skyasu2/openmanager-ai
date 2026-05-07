export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface PredictionDataPoint {
  timestamp: string;
  predicted: number;
  upper: number;
  lower: number;
}

export interface AnomalyDataPoint {
  startTime: string;
  endTime: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface TimeSeriesChartProps {
  data: MetricDataPoint[];
  predictions?: PredictionDataPoint[];
  anomalies?: AnomalyDataPoint[];
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  timeRange?: '1h' | '6h' | '24h' | '7d';
  thresholds?: { warning: number; critical: number };
  height?: number;
  showPrediction?: boolean;
  showAnomalies?: boolean;
  showThresholds?: boolean;
  showBrush?: boolean;
  compact?: boolean;
}
