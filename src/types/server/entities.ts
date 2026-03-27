/**
 * Server Entity Types
 *
 * 서버 관련 엔티티 (Service, LogEntry, NetworkInfo 등)
 */

import type { ServiceStatus } from '../common';
import type { ProcessInfo, ServerAlert } from './base';
import type { ServerEnvironment, ServerRole, ServerStatus } from './types';

/**
 * 서비스 정보
 */
export interface Service {
  name: string;
  status: ServiceStatus;
  port?: number;
  environment?: ServerEnvironment;
  role?: ServerRole;
}

/**
 * 로그 항목
 */
export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

/**
 * 네트워크 정보
 */
export interface NetworkInfo {
  interface: string;
  receivedBytes: string;
  sentBytes: string;
  receivedUtilizationPercent?: number;
  sentUtilizationPercent?: number;
  receivedErrors: number;
  sentErrors: number;
  status?: ServerStatus;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  uptime?: number;
  last_updated?: string;
  alerts?: ServerAlert[];
  processes?: ProcessInfo[];
  environment?: ServerEnvironment;
  role?: ServerRole;
}

/**
 * 시스템 정보
 */
export interface SystemInfo {
  os: string;
  uptime: string;
  processes: number;
  zombieProcesses: number;
  loadAverage: string;
  lastUpdate: string;
  environment?: ServerEnvironment;
  role?: ServerRole;
}

/**
 * 서버 메타데이터
 */
export interface ServerMetadata {
  id: string;
  ip: string;
  name: string;
  location: string;
  os: string;
  type: string;
  isActive: boolean;
  processes: ProcessInfo[];
}
