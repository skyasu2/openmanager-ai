/**
 * OpenManager Vibe V5 - Core Types
 * 모든 타입은 readonly로 정의하여 불변성 보장
 * any 타입 절대 사용 금지
 */

// 🖥️ 서버 관련 타입
// Note: ServerStatus (union type) is defined in server-enums.ts
// This interface represents a server status *object* with full details
export interface ServerStatusInfo {
  readonly id: string;
  readonly name: string;
  readonly status: 'online' | 'offline' | 'warning' | 'error';
  readonly lastUpdate: string;
  readonly location: string;
  readonly uptime: number;
  readonly metrics: LegacyServerMetrics;
}

/** @deprecated Use ServerMetrics from '@/types/server-metrics' (SSOT) or ApiServerMetrics from '@/services/metrics/types' */
export interface LegacyServerMetrics {
  readonly cpu: number; // 0-100 percentage
  readonly memory: number; // 0-100 percentage
  readonly disk: number; // 0-100 percentage
  readonly network: NetworkMetrics;
  readonly processes: number;
  readonly loadAverage: readonly [number, number, number]; // 1min, 5min, 15min
}

export interface NetworkMetrics {
  readonly bytesIn: number; // bytes/second
  readonly bytesOut: number; // bytes/second
  readonly packetsIn: number;
  readonly packetsOut: number;
  readonly latency: number; // milliseconds
  readonly connections: number;
}

// 🤖 MCP (자연어 처리) 관련 타입
export interface MCPQuery {
  readonly id: string;
  readonly query: string;
  readonly intent: MCPIntent;
  readonly confidence: number; // 0-1
  readonly timestamp: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly context?: Readonly<Record<string, string>>;
}

export type MCPIntent =
  | 'server_status'
  | 'performance_analysis'
  | 'troubleshooting'
  | 'resource_monitoring'
  | 'alert_management'
  | 'prediction'
  | 'general_inquiry';

export interface MCPResponse {
  readonly id: string;
  readonly queryId: string;
  readonly response: string;
  readonly relatedServers: readonly string[];
  readonly recommendations: readonly string[];
  readonly confidence: number;
  readonly timestamp: string;
  readonly sources: readonly string[];
  readonly actionable: boolean;
}

// 🚨 알림 및 모니터링 타입
export interface MonitoringAlert {
  readonly id: string;
  readonly serverId: string;
  readonly severity: AlertSeverity;
  readonly type: AlertType;
  readonly message: string;
  readonly description?: string;
  readonly timestamp: string;
  readonly resolved: boolean;
  readonly resolvedAt?: string;
  readonly acknowledgedBy?: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertType =
  | 'cpu_high'
  | 'memory_high'
  | 'disk_full'
  | 'network_issue'
  | 'service_down'
  | 'security_threat'
  | 'performance_degradation';

// 📊 대시보드 관련 타입
export interface DashboardData {
  readonly servers: readonly ServerStatusInfo[];
  readonly alerts: readonly MonitoringAlert[];
  readonly systemOverview: SystemOverview;
  readonly recentQueries: readonly MCPQuery[];
  readonly timestamp: string;
}

export interface SystemOverview {
  readonly totalServers: number;
  readonly onlineServers: number;
  readonly criticalAlerts: number;
  readonly averageResponseTime: number;
  readonly _systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
}

// 🎯 공통 유틸리티 타입
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}
