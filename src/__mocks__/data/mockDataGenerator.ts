/**
 * 24시간 시계열 데이터 생성기 (5분 간격, 288개 포인트)
 * 15개 서버, 4개 장애 시나리오
 */

import type { ScenarioPoint } from './mockScenarios';
import {
  generate24HourData,
  getServerStatus as getMetricBasedStatus,
  SERVERS,
} from './mockScenarios';
export type { ScenarioPoint };

import type { Server } from '@/types/server';
import type { ServerStatus } from '@/types/server-enums';

export interface TimeSeriesData {
  timestamp: number;
  metrics: ScenarioPoint;
}

export interface ServerTimeSeriesData {
  serverId: string;
  data: ScenarioPoint[]; // 288개 포인트
}

export interface MockServerData {
  servers: Server[];
  timeSeries: Record<string, ServerTimeSeriesData>;
  metadata: {
    generatedAt: string;
    totalDataPoints: number; // 288 * 15 = 4,320
    dataPointsPerServer: number; // 288
    intervalMinutes: number; // 5분
  };
}

/**
 * 서버 메트릭을 Server 타입으로 변환
 */
function createServerFromMetrics(
  serverId: string,
  currentMetrics: ScenarioPoint,
  status: ServerStatus
): Server {
  const server = SERVERS.find((s) => s.id === serverId);

  // Fallback: 서버 메타데이터가 없으면 기본값 사용
  if (!server) {
    console.warn(
      `Server ${serverId} not found in SERVERS, using fallback metadata`
    );
    return {
      id: serverId,
      name: serverId.toUpperCase(),
      status,
      cpu: Math.round(currentMetrics.cpu),
      memory: Math.round(currentMetrics.memory),
      disk: Math.round(currentMetrics.disk),
      network: Math.round(currentMetrics.network),
      uptime: 99.99,
      lastUpdate: new Date(),
      location: 'Seoul-DC-01',
      type: 'app', // fallback type
      services: [
        {
          name: 'Unknown Service',
          status: status === 'online' ? 'running' : 'stopped',
          port: 8080,
        },
      ],
      alerts: status !== 'online' ? 1 : 0,
    };
  }

  return {
    id: server.id,
    name: server.name,
    status,
    cpu: Math.round(currentMetrics.cpu),
    memory: Math.round(currentMetrics.memory),
    disk: Math.round(currentMetrics.disk),
    network: Math.round(currentMetrics.network),
    uptime: 99.99,
    lastUpdate: new Date(),
    location: 'Seoul-DC-01',
    type: server.type,
    services: [
      {
        name: server.description,
        status: status === 'online' ? 'running' : 'stopped',
        port: 8080,
      },
    ],
    alerts: status !== 'online' ? 1 : 0,
  };
}

/**
 * 메트릭 기반 서버 상태 결정 (AI-blind)
 * mockScenarios의 getServerStatus를 활용
 */
function determineServerStatus(metrics: ScenarioPoint): ServerStatus {
  return getMetricBasedStatus(metrics);
}

/**
 * 전체 목업 데이터 생성
 */
export function generateMockServerData(): MockServerData {
  const servers: Server[] = [];
  const timeSeries: Record<string, ServerTimeSeriesData> = {};

  // 15개 서버 각각에 대해 데이터 생성
  SERVERS.forEach((server) => {
    // 24시간 데이터 생성 (5분 간격, 288개 포인트)
    const data = generate24HourData(server.id);

    // 현재 시점의 메트릭 (랜덤하게 선택)
    const currentIndex = Math.floor(Math.random() * data.length);
    const currentMetrics = data[currentIndex] || data[0];

    if (!currentMetrics) {
      throw new Error(`No metrics generated for server ${server.id}`);
    }

    // 현재 서버 상태 결정 (메트릭 기반)
    const status = determineServerStatus(currentMetrics);

    // Server 객체 생성
    servers.push(createServerFromMetrics(server.id, currentMetrics, status));

    // 시계열 데이터 저장
    timeSeries[server.id] = {
      serverId: server.id,
      data,
    };
  });

  return {
    servers,
    timeSeries,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalDataPoints: 288 * SERVERS.length, // 4,320 포인트
      dataPointsPerServer: 288,
      intervalMinutes: 5,
    },
  };
}

/**
 * 데이터 크기 계산
 */
export function calculateDataSize(data: MockServerData): {
  totalBytes: number;
  perServerBytes: number;
  totalKB: number;
  perServerKB: number;
} {
  const jsonString = JSON.stringify(data);
  const totalBytes = new Blob([jsonString]).size;
  const perServerBytes = totalBytes / SERVERS.length;

  return {
    totalBytes,
    perServerBytes,
    totalKB: Math.round(totalBytes / 1024),
    perServerKB: Math.round(perServerBytes / 1024),
  };
}
