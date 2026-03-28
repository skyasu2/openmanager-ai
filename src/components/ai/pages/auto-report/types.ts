/**
 * Auto Report Page Types
 *
 * 자동 장애 보고서 관련 타입 정의
 */

export const INCIDENT_REPORT_SEVERITIES = [
  'critical',
  'warning',
  'info',
  'high',
  'medium',
  'low',
] as const;

export type IncidentSeverity = (typeof INCIDENT_REPORT_SEVERITIES)[number];

export const INCIDENT_REPORT_STATUSES = [
  'active',
  'resolved',
  'investigating',
] as const;

export type IncidentStatus = (typeof INCIDENT_REPORT_STATUSES)[number];

export function isIncidentSeverity(value: string): value is IncidentSeverity {
  return (INCIDENT_REPORT_SEVERITIES as readonly string[]).includes(value);
}

export function normalizeIncidentSeverity(value: string): IncidentSeverity {
  const normalizedValue = value.toLowerCase();

  if (isIncidentSeverity(normalizedValue)) {
    return normalizedValue;
  }

  switch (normalizedValue) {
    case 'urgent':
      return 'critical';
    case 'warn':
      return 'warning';
    default:
      return 'info';
  }
}

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (INCIDENT_REPORT_STATUSES as readonly string[]).includes(value);
}

export function normalizeIncidentStatus(value: string): IncidentStatus {
  const normalizedValue = value.toLowerCase();

  if (isIncidentStatus(normalizedValue)) {
    return normalizedValue;
  }

  switch (normalizedValue) {
    case 'open':
      return 'active';
    case 'closed':
      return 'resolved';
    default:
      return 'investigating';
  }
}

/**
 * 장애 보고서 인터페이스
 */
export interface IncidentReport {
  id: string;
  title: string;
  severity: IncidentSeverity;
  timestamp: Date;
  affectedServers: string[];
  description: string;
  status: IncidentStatus;
  pattern?: string;
  recommendations?: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  // 전체 시스템 분석 데이터
  systemSummary?: {
    totalServers: number;
    healthyServers: number;
    warningServers: number;
    criticalServers: number;
  };
  anomalies?: Array<{
    server_id: string;
    server_name: string;
    metric: string;
    value: number;
    severity: string;
  }>;
  timeline?: Array<{
    timestamp: string;
    event: string;
    severity: string;
  }>;
}

/**
 * 서버 메트릭 데이터
 */
export interface ServerMetric {
  server_id: string;
  server_name: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp: string;
}
