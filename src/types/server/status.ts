/**
 * Server Status & Scenario Types
 *
 * 장애 시나리오, 시뮬레이션 상태 관련 타입
 */

import type { AlertSeverity } from '../common';
import type { ServerMetrics } from '../server-common';
import type { ServerAlert } from './metrics';
import type { ServerRole } from './types';

/**
 * 장애 단계
 */
export interface FailureStep {
  delay: number; // ms
  server_id: string;
  metric: keyof Pick<ServerMetrics, 'cpu' | 'memory' | 'disk' | 'network'>;
  value: number;
  alert?: Omit<ServerAlert, 'id' | 'server_id' | 'timestamp'>;
}

/**
 * 장애 시나리오
 */
export interface FailureScenario {
  id: string;
  name: string;
  servers: string[];
  steps: FailureStep[];
  probability: number;
}

/**
 * 현실적 장애 시나리오 (연쇄 효과 포함)
 */
export interface RealisticFailureScenario {
  id: string;
  name: string;
  description: string;
  triggerCondition: {
    serverType: ServerRole;
    metric: keyof ServerMetrics;
    threshold: number;
    operator: '>' | '<' | '=' | '>=' | '<=';
  };
  cascadeEffect: {
    targetServerType: ServerRole;
    delayMs: number;
    impact: {
      metric: keyof ServerMetrics;
      multiplier: number;
    };
    alertMessage: string;
    severity: AlertSeverity;
  }[];
  recoveryTimeMs: number;
  probability: number;
}

/**
 * 시뮬레이션 상태
 */
export interface SimulationState {
  isRunning: boolean;
  startTime: number | null;
  servers: ServerMetrics[];
  activeScenarios: string[];
  dataCount: number;
  intervalId: NodeJS.Timeout | null;
}

/**
 * 시스템 개요
 */
export interface SystemOverview {
  total: number;
  online: number;
  warning: number;
  offline: number;
  avgCpu: number;
  avgMemory: number;
}

/**
 * 데이터 저장소
 */
export interface DataStorage {
  realtime_metrics: ServerMetrics[];
  daily_metrics: ServerMetrics[];
  last_cleanup: string;
}
