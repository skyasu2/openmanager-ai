/**
 * Type definitions and interfaces for the server data system.
 *
 * @see server-data-loader.ts - Main orchestration facade
 */

export type { EnhancedServerMetrics } from '@/types/server/metrics';

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
