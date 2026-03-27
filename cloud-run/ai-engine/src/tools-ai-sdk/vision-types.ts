export type DashboardType =
  | 'grafana'
  | 'cloudwatch'
  | 'datadog'
  | 'prometheus'
  | 'newrelic'
  | 'custom'
  | 'unknown';

export type FocusArea =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'
  | 'latency'
  | 'errors'
  | 'all';

export type LogType =
  | 'syslog'
  | 'application'
  | 'access'
  | 'error'
  | 'security'
  | 'custom';

export type SearchType =
  | 'technical'
  | 'security'
  | 'documentation'
  | 'troubleshooting'
  | 'general';

export interface ScreenshotAnalysisResult {
  success: boolean;
  dashboardType: string;
  focusArea?: FocusArea;
  findings: {
    anomalies: string[];
    trends: string[];
    thresholdBreaches: string[];
    recommendations: string[];
  };
  metrics: {
    name: string;
    currentValue: string;
    status: 'normal' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
  }[];
  timeRange?: string;
  summary: string;
}

export interface LogAnalysisResult {
  success: boolean;
  logType: string;
  totalLines: number;
  analyzedLines: number;
  findings: {
    errorCount: number;
    warnCount: number;
    topErrors: {
      message: string;
      count: number;
      firstSeen: string;
      lastSeen: string;
    }[];
    patterns: { pattern: string; frequency: number; severity: string }[];
    timeline: { timestamp: string; event: string; severity: string }[];
  };
  rootCauseHypothesis?: string;
  recommendations: string[];
  summary: string;
}

export interface SearchGroundingResult {
  success: boolean;
  query: string;
  results: {
    title: string;
    snippet: string;
    url: string;
    relevanceScore: number;
  }[];
  summary: string;
  recommendations: string[];
}

export interface UrlContentResult {
  success: boolean;
  url: string;
  title: string;
  contentType: string;
  extractedSections: {
    heading: string;
    content: string;
    relevance: 'high' | 'medium' | 'low';
  }[];
  summary: string;
  applicableActions: string[];
}
