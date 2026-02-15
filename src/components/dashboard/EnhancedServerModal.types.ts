/**
 * 📝 Enhanced Server Modal Type Definitions
 *
 * Type definitions and interfaces for the server modal system
 * - Server data interfaces
 * - Modal props and state types
 * - Real-time data structures
 * - Tab navigation types
 */

import type { ComponentType } from 'react';
import type { ServerStatus } from '@/types/server-enums'; // 🔧 수정: Single Source of Truth

// 🔧 수정: re-export 제거, 직접 사용
export type NetworkStatus = 'excellent' | 'good' | 'poor' | 'offline';
export type LogLevel = 'info' | 'warn' | 'error';
export type ServiceStatus =
  | 'running'
  | 'stopped'
  | 'warning'
  | 'failed'
  | 'starting'
  | 'stopping'
  | 'error'
  | 'unknown';
export type TabId = 'overview' | 'metrics' | 'processes' | 'logs' | 'network';
export type TimeRange = '5m' | '1h' | '6h' | '24h' | '7d';

export interface ServerService {
  name: string;
  status: ServiceStatus;
  port: number;
}

export interface ServerSpecs {
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  network_speed?: string;
}

export interface ServerHealth {
  score: number;
  trend: number[];
}

export interface AlertsSummary {
  total: number;
  critical: number;
  warning: number;
}

export interface ServerData {
  id: string;
  hostname: string;
  name: string;
  type: string;
  environment: string;
  location: string;
  provider: string;
  status: ServerStatus;
  cpu: number;
  memory: number;
  disk: number;
  network?: number;
  uptime: string;
  lastUpdate: Date;
  alerts: number;
  services: ServerService[];
  specs?: ServerSpecs;
  os?: string;
  ip?: string;
  networkStatus?: NetworkStatus;
  health?: ServerHealth;
  alertsSummary?: AlertsSummary;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

export interface RealtimeData {
  cpu: number[];
  memory: number[];
  disk: number[];
  network: number[];
  logs: LogEntry[];
}

import type { Server } from '@/types/server';

export interface EnhancedServerModalProps {
  server: Server | null;
  onClose: () => void;
}

export interface TabInfo {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface StatusTheme {
  gradient: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  badge: string;
  icon: string;
}

export interface MetricColorResult {
  color: string;
  gradient: string;
}

export interface ChartData {
  data: number[];
  color: string;
  label: string;
  icon: string;
  gradient: string;
}
