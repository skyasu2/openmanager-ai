import type { ServerStatus } from '@/types/server-enums';

export type { ServerStatus };

export interface ScenarioPoint {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime?: number; // ms
  errorRate?: number; // percentage
}

/**
 * 🎯 서버 타입 정의 (SSOT와 일치)
 * @see src/__mocks__/data/mockServerConfig.ts
 */
export type ServerType =
  | 'web'
  | 'application'
  | 'database'
  | 'cache'
  | 'storage'
  | 'loadbalancer'
  // Legacy 호환성
  | 'api'
  | 'app'
  | 'log'
  | 'monitoring';

export interface Server {
  id: string;
  name: string;
  type: ServerType;
  description: string;
}

export interface ScenarioPhase {
  name: string;
  durationHours: number;
  serverMetrics: {
    serverId: string;
    metrics: {
      cpu: number[]; // [시작값, 종료값]
      memory: number[];
      disk: number[];
      network: number[];
      responseTime?: number[];
      errorRate?: number[];
    };
    curveType: 'linear' | 'exponential' | 'spike'; // 변화 패턴
  }[];
}

export interface ScenarioTimeline {
  id: string;
  name: string;
  timeRange: [number, number];
  phases: ScenarioPhase[];
}

export interface ServerMetricsSnapshot {
  timestamp: Date;
  servers: Array<{
    id: string;
    name: string;
    type: ServerType;
    metrics: ScenarioPoint;
    status: ServerStatus;
  }>;
}
