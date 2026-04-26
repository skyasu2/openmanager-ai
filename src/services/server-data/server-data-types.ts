/**
 * Type definitions and interfaces for the server data system.
 *
 * @see server-data-loader.ts - Main orchestration facade
 */

import type { OTelLogRecord } from '@/types/otel-metrics';

// Enhanced Server Metrics 인터페이스 (route.ts와 동기화 필요)
export interface EnhancedServerMetrics {
  id: string;
  name: string;
  hostname: string;
  status:
    | 'online'
    | 'offline'
    | 'warning'
    | 'critical'
    | 'maintenance'
    | 'unknown';
  cpu: number;
  cpu_usage: number;
  memory: number;
  memory_usage: number;
  disk: number;
  disk_usage: number;
  network: number;
  network_in: number;
  network_out: number;
  uptime: number;
  responseTime: number;
  last_updated: string;
  location: string;
  alerts: never[]; // 항상 빈 배열
  ip: string;
  os: string;
  type: string;
  role: string;
  environment: string;
  provider: string;
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    network_speed: string;
  };
  lastUpdate: string;
  services: unknown[]; // 외부 데이터, 런타임에서 검증됨
  systemInfo: {
    os: string;
    uptime: string;
    processes: number;
    zombieProcesses: number;
    loadAverage: string;
    lastUpdate: string;
  };
  networkInfo: {
    interface: string;
    receivedBytes: string;
    sentBytes: string;
    receivedUtilizationPercent?: number;
    sentUtilizationPercent?: number;
    receivedErrors: number;
    sentErrors: number;
    status:
      | 'online'
      | 'offline'
      | 'warning'
      | 'critical'
      | 'maintenance'
      | 'unknown';
  };
  /** OTel structured logs for this server (optional, populated by OTel-Direct pipeline) */
  structuredLogs?: OTelLogRecord[];
}

export interface RawServerData {
  id: string;
  name: string;
  hostname: string;
  type: string;
  location: string;
  environment: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime: number;
  uptime: number;
  ip: string;
  os: string;
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
  };
  services: string[];
  processes: number;
  /** node_load1 from Prometheus (1-min load average) */
  load1: number;
  /** node_load5 from Prometheus (5-min load average) */
  load5: number;
}

/** Log entry returned by generateServerLogs */
export type ServerLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
  traceId?: string;
  spanId?: string;
  structuredData?: Record<string, unknown>;
};
