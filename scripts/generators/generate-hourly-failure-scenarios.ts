#!/usr/bin/env tsx
/**
 * 🎯 5시간대 장애 시나리오 JSON 생성기
 *
 * 목적: 포트폴리오 시연용 더미 서버 메트릭 생성
 * - 무료 티어 보호 (정적 JSON, DB 부하 제로)
 * - 24시간 × 12포인트 (5분 간격) = 288 데이터 포인트
 * - 5시간대별 장애 시나리오 (DB/네트워크/메모리/디스크/CPU)
 * - AI 어시스턴트가 이전 메트릭 분석 → 장애 원인 진단
 */

import fs from 'fs';
import path from 'path';

const LEGACY_GUARD_ENV = 'ALLOW_LEGACY_HOURLY_DATA';

function assertLegacyMode(): void {
  if (process.env[LEGACY_GUARD_ENV] !== 'true') {
    throw new Error(
      [
        '[BLOCKED] Legacy hourly-data generator is disabled by default.',
        `Set ${LEGACY_GUARD_ENV}=true only for intentional legacy regeneration.`,
        'Primary data pipeline uses public/data/otel-data.',
      ].join('\n')
    );
  }
}

// ============================================================================
// 타입 정의
// ============================================================================

type ServerStatus =
  | 'online'
  | 'warning'
  | 'critical'
  | 'maintenance'
  | 'offline';
type ServerRole =
  | 'web'
  | 'api'
  | 'database'
  | 'cache'
  | 'storage'
  | 'load-balancer'
  | 'backup'
  | 'monitoring'
  | 'security';

interface ServerMetric {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime?: number;
  errorRate?: number;
}

interface ServerSpecs {
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
}

interface ServerConfig {
  id: string;
  name: string;
  hostname: string;
  role: ServerRole;
  type: string;
  location: string;
  environment: 'production' | 'staging' | 'development';
  specs: ServerSpecs;
}

interface HourlyScenario {
  hour: number;
  incident: string;
  affected_servers: {
    id: string;
    status: ServerStatus;
    metrics: ServerMetric;
  }[];
}

// ============================================================================
// 서버 설정 (15개)
// ============================================================================

const SERVER_CONFIGS: ServerConfig[] = [
  // Web Servers (3개)
  {
    id: 'web-prd-01',
    name: 'Web Production 01',
    hostname: 'web-prd-01.example.com',
    role: 'web',
    type: 'web',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 200 },
  },
  {
    id: 'web-prd-02',
    name: 'Web Production 02',
    hostname: 'web-prd-02.example.com',
    role: 'web',
    type: 'web',
    location: 'us-east-1b',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 200 },
  },
  {
    id: 'web-stg-01',
    name: 'Web Staging 01',
    hostname: 'web-stg-01.example.com',
    role: 'web',
    type: 'web',
    location: 'us-west-1a',
    environment: 'staging',
    specs: { cpu_cores: 2, memory_gb: 4, disk_gb: 100 },
  },

  // API Servers (2개)
  {
    id: 'api-prd-01',
    name: 'API Production 01',
    hostname: 'api-prd-01.example.com',
    role: 'api',
    type: 'api',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 6, memory_gb: 16, disk_gb: 300 },
  },
  {
    id: 'api-prd-02',
    name: 'API Production 02',
    hostname: 'api-prd-02.example.com',
    role: 'api',
    type: 'api',
    location: 'us-east-1b',
    environment: 'production',
    specs: { cpu_cores: 6, memory_gb: 16, disk_gb: 300 },
  },

  // Database Servers (2개)
  {
    id: 'db-main-01',
    name: 'Database Main 01',
    hostname: 'db-main-01.example.com',
    role: 'database',
    type: 'database',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 8, memory_gb: 32, disk_gb: 500 },
  },
  {
    id: 'db-repl-01',
    name: 'Database Replica 01',
    hostname: 'db-repl-01.example.com',
    role: 'database',
    type: 'database',
    location: 'us-east-1b',
    environment: 'production',
    specs: { cpu_cores: 8, memory_gb: 32, disk_gb: 500 },
  },

  // Cache Servers (2개)
  {
    id: 'cache-redis-01',
    name: 'Redis Cache 01',
    hostname: 'cache-redis-01.example.com',
    role: 'cache',
    type: 'cache',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 16, disk_gb: 100 },
  },
  {
    id: 'cache-redis-02',
    name: 'Redis Cache 02',
    hostname: 'cache-redis-02.example.com',
    role: 'cache',
    type: 'cache',
    location: 'us-east-1b',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 16, disk_gb: 100 },
  },

  // Storage (2개)
  {
    id: 'storage-nas-01',
    name: 'NAS Storage 01',
    hostname: 'storage-nas-01.example.com',
    role: 'storage',
    type: 'storage',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 2000 },
  },
  {
    id: 'storage-s3-gateway',
    name: 'S3 Gateway',
    hostname: 'storage-s3.example.com',
    role: 'storage',
    type: 'storage',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 2, memory_gb: 4, disk_gb: 1000 },
  },

  // Load Balancer (1개)
  {
    id: 'lb-main-01',
    name: 'Load Balancer Main',
    hostname: 'lb-main-01.example.com',
    role: 'load-balancer',
    type: 'load-balancer',
    location: 'us-east-1',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
  },

  // Monitoring (1개)
  {
    id: 'monitor-01',
    name: 'Monitoring Server',
    hostname: 'monitor-01.example.com',
    role: 'monitoring',
    type: 'monitoring',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 500 },
  },

  // Backup (1개)
  {
    id: 'backup-server-01',
    name: 'Backup Server 01',
    hostname: 'backup-01.example.com',
    role: 'backup',
    type: 'backup',
    location: 'us-west-1a',
    environment: 'production',
    specs: { cpu_cores: 2, memory_gb: 8, disk_gb: 1000 },
  },

  // Security (1개)
  {
    id: 'security-gateway-01',
    name: 'Security Gateway',
    hostname: 'security-01.example.com',
    role: 'security',
    type: 'security',
    location: 'us-east-1a',
    environment: 'production',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 200 },
  },
];

// ============================================================================
// 역할별 Baseline 메트릭 (BaselineOptimizer에서 추출)
// ============================================================================

const ROLE_BASELINE_METRICS: Record<ServerRole, ServerMetric> = {
  web: { cpu: 35, memory: 40, disk: 30, network: 50, responseTime: 150 },
  api: { cpu: 45, memory: 50, disk: 25, network: 60, responseTime: 200 },
  database: { cpu: 60, memory: 70, disk: 50, network: 40, responseTime: 100 },
  cache: { cpu: 25, memory: 80, disk: 20, network: 30, responseTime: 50 },
  storage: { cpu: 40, memory: 50, disk: 70, network: 45, responseTime: 150 },
  'load-balancer': {
    cpu: 50,
    memory: 45,
    disk: 30,
    network: 80,
    responseTime: 60,
  },
  backup: { cpu: 35, memory: 40, disk: 85, network: 30, responseTime: 120 },
  monitoring: { cpu: 30, memory: 35, disk: 60, network: 25, responseTime: 100 },
  security: { cpu: 40, memory: 45, disk: 35, network: 50, responseTime: 80 },
};

// ============================================================================
// 5시간대 장애 시나리오
// ============================================================================

const FAILURE_SCENARIOS: HourlyScenario[] = [
  // 시간대 1: 0-4시 - DB 백업 장애
  {
    hour: 0,
    incident: 'DB 자동 백업 시작 - 디스크 I/O 증가',
    affected_servers: [
      {
        id: 'db-main-01',
        status: 'warning',
        metrics: {
          cpu: 65,
          memory: 70,
          disk: 75,
          network: 45,
          responseTime: 200,
        },
      },
      {
        id: 'db-repl-01',
        status: 'online',
        metrics: {
          cpu: 55,
          memory: 65,
          disk: 70,
          network: 40,
          responseTime: 150,
        },
      },
    ],
  },
  {
    hour: 1,
    incident: 'DB 인덱스 재구축 - CPU 부하 증가',
    affected_servers: [
      {
        id: 'db-main-01',
        status: 'warning',
        metrics: {
          cpu: 85,
          memory: 75,
          disk: 80,
          network: 50,
          responseTime: 350,
        },
      },
      {
        id: 'db-repl-01',
        status: 'warning',
        metrics: {
          cpu: 70,
          memory: 70,
          disk: 75,
          network: 45,
          responseTime: 250,
        },
      },
    ],
  },
  {
    hour: 2,
    incident: 'DB 슬로우 쿼리 누적 - 심각한 성능 저하',
    affected_servers: [
      {
        id: 'db-main-01',
        status: 'critical',
        metrics: {
          cpu: 95,
          memory: 90,
          disk: 85,
          network: 55,
          responseTime: 5000,
          errorRate: 5,
        },
      },
      {
        id: 'db-repl-01',
        status: 'critical',
        metrics: {
          cpu: 90,
          memory: 85,
          disk: 80,
          network: 50,
          responseTime: 4000,
          errorRate: 3,
        },
      },
      {
        id: 'api-prd-01',
        status: 'warning',
        metrics: {
          cpu: 70,
          memory: 60,
          disk: 30,
          network: 65,
          responseTime: 800,
        },
      },
      {
        id: 'api-prd-02',
        status: 'warning',
        metrics: {
          cpu: 65,
          memory: 55,
          disk: 28,
          network: 60,
          responseTime: 750,
        },
      },
    ],
  },
  {
    hour: 3,
    incident: 'DB 쿼리 최적화 시작 - 복구 진행 중',
    affected_servers: [
      {
        id: 'db-main-01',
        status: 'warning',
        metrics: {
          cpu: 70,
          memory: 75,
          disk: 75,
          network: 48,
          responseTime: 300,
        },
      },
      {
        id: 'db-repl-01',
        status: 'warning',
        metrics: {
          cpu: 65,
          memory: 70,
          disk: 72,
          network: 45,
          responseTime: 250,
        },
      },
      {
        id: 'api-prd-01',
        status: 'online',
        metrics: {
          cpu: 50,
          memory: 52,
          disk: 26,
          network: 62,
          responseTime: 220,
        },
      },
    ],
  },
  {
    hour: 4,
    incident: 'DB 복구 완료',
    affected_servers: [
      {
        id: 'db-main-01',
        status: 'online',
        metrics: {
          cpu: 50,
          memory: 60,
          disk: 65,
          network: 42,
          responseTime: 120,
        },
      },
      {
        id: 'db-repl-01',
        status: 'online',
        metrics: {
          cpu: 48,
          memory: 58,
          disk: 63,
          network: 40,
          responseTime: 110,
        },
      },
    ],
  },

  // 시간대 2: 5-9시 - 네트워크/Load Balancer 장애
  {
    hour: 5,
    incident: '배치 작업 시작 - 트래픽 증가',
    affected_servers: [
      {
        id: 'lb-main-01',
        status: 'online',
        metrics: {
          cpu: 55,
          memory: 50,
          disk: 32,
          network: 60,
          responseTime: 70,
        },
      },
      {
        id: 'web-prd-01',
        status: 'online',
        metrics: {
          cpu: 45,
          memory: 42,
          disk: 32,
          network: 55,
          responseTime: 160,
        },
      },
      {
        id: 'web-prd-02',
        status: 'online',
        metrics: {
          cpu: 42,
          memory: 40,
          disk: 31,
          network: 53,
          responseTime: 155,
        },
      },
    ],
  },
  {
    hour: 6,
    incident: 'Load Balancer 과부하 시작',
    affected_servers: [
      {
        id: 'lb-main-01',
        status: 'warning',
        metrics: {
          cpu: 75,
          memory: 65,
          disk: 35,
          network: 80,
          responseTime: 120,
        },
      },
      {
        id: 'web-prd-01',
        status: 'warning',
        metrics: {
          cpu: 70,
          memory: 55,
          disk: 35,
          network: 75,
          responseTime: 280,
        },
      },
      {
        id: 'web-prd-02',
        status: 'warning',
        metrics: {
          cpu: 68,
          memory: 52,
          disk: 34,
          network: 73,
          responseTime: 270,
        },
      },
    ],
  },
  {
    hour: 7,
    incident: '네트워크 패킷 손실 발생 - 심각한 장애',
    affected_servers: [
      {
        id: 'lb-main-01',
        status: 'critical',
        metrics: {
          cpu: 95,
          memory: 85,
          disk: 38,
          network: 95,
          responseTime: 3000,
          errorRate: 5,
        },
      },
      {
        id: 'web-prd-01',
        status: 'critical',
        metrics: {
          cpu: 92,
          memory: 80,
          disk: 38,
          network: 92,
          responseTime: 3500,
          errorRate: 7,
        },
      },
      {
        id: 'web-prd-02',
        status: 'critical',
        metrics: {
          cpu: 90,
          memory: 78,
          disk: 37,
          network: 90,
          responseTime: 3200,
          errorRate: 6,
        },
      },
    ],
  },
  {
    hour: 8,
    incident: 'Auto-scaling 시작 - 복구 진행 중',
    affected_servers: [
      {
        id: 'lb-main-01',
        status: 'warning',
        metrics: {
          cpu: 70,
          memory: 70,
          disk: 36,
          network: 70,
          responseTime: 100,
        },
      },
      {
        id: 'web-prd-01',
        status: 'warning',
        metrics: {
          cpu: 65,
          memory: 60,
          disk: 36,
          network: 68,
          responseTime: 200,
        },
      },
      {
        id: 'web-prd-02',
        status: 'warning',
        metrics: {
          cpu: 63,
          memory: 58,
          disk: 35,
          network: 66,
          responseTime: 190,
        },
      },
    ],
  },
  {
    hour: 9,
    incident: '네트워크 복구 완료',
    affected_servers: [
      {
        id: 'lb-main-01',
        status: 'online',
        metrics: {
          cpu: 50,
          memory: 55,
          disk: 33,
          network: 50,
          responseTime: 65,
        },
      },
      {
        id: 'web-prd-01',
        status: 'online',
        metrics: {
          cpu: 40,
          memory: 45,
          disk: 33,
          network: 52,
          responseTime: 155,
        },
      },
      {
        id: 'web-prd-02',
        status: 'online',
        metrics: {
          cpu: 38,
          memory: 43,
          disk: 32,
          network: 50,
          responseTime: 150,
        },
      },
    ],
  },

  // 시간대 3: 10-14시 - 메모리 누수 장애
  {
    hour: 10,
    incident: '캐시 메모리 사용률 증가 감지',
    affected_servers: [
      {
        id: 'cache-redis-01',
        status: 'online',
        metrics: {
          cpu: 35,
          memory: 70,
          disk: 22,
          network: 35,
          responseTime: 55,
        },
      },
      {
        id: 'api-prd-01',
        status: 'online',
        metrics: {
          cpu: 48,
          memory: 55,
          disk: 27,
          network: 62,
          responseTime: 210,
        },
      },
    ],
  },
  {
    hour: 11,
    incident: '메모리 누수 패턴 확인',
    affected_servers: [
      {
        id: 'cache-redis-01',
        status: 'warning',
        metrics: {
          cpu: 45,
          memory: 85,
          disk: 24,
          network: 38,
          responseTime: 80,
        },
      },
      {
        id: 'cache-redis-02',
        status: 'warning',
        metrics: {
          cpu: 40,
          memory: 82,
          disk: 23,
          network: 36,
          responseTime: 75,
        },
      },
      {
        id: 'api-prd-01',
        status: 'warning',
        metrics: {
          cpu: 60,
          memory: 65,
          disk: 28,
          network: 68,
          responseTime: 350,
        },
      },
    ],
  },
  {
    hour: 12,
    incident: 'OOM Killer 동작 직전 - 심각한 메모리 부족',
    affected_servers: [
      {
        id: 'cache-redis-01',
        status: 'critical',
        metrics: {
          cpu: 65,
          memory: 95,
          disk: 26,
          network: 42,
          responseTime: 2000,
          errorRate: 8,
        },
      },
      {
        id: 'cache-redis-02',
        status: 'critical',
        metrics: {
          cpu: 62,
          memory: 93,
          disk: 25,
          network: 40,
          responseTime: 1800,
          errorRate: 7,
        },
      },
      {
        id: 'api-prd-01',
        status: 'critical',
        metrics: {
          cpu: 75,
          memory: 88,
          disk: 30,
          network: 75,
          responseTime: 4000,
          errorRate: 10,
        },
      },
      {
        id: 'api-prd-02',
        status: 'warning',
        metrics: {
          cpu: 68,
          memory: 78,
          disk: 29,
          network: 70,
          responseTime: 1200,
        },
      },
    ],
  },
  {
    hour: 13,
    incident: '캐시 재시작 - 복구 진행 중',
    affected_servers: [
      {
        id: 'cache-redis-01',
        status: 'warning',
        metrics: {
          cpu: 40,
          memory: 60,
          disk: 23,
          network: 33,
          responseTime: 60,
        },
      },
      {
        id: 'cache-redis-02',
        status: 'warning',
        metrics: {
          cpu: 38,
          memory: 58,
          disk: 22,
          network: 32,
          responseTime: 58,
        },
      },
      {
        id: 'api-prd-01',
        status: 'warning',
        metrics: {
          cpu: 52,
          memory: 58,
          disk: 27,
          network: 64,
          responseTime: 280,
        },
      },
    ],
  },
  {
    hour: 14,
    incident: '메모리 복구 완료',
    affected_servers: [
      {
        id: 'cache-redis-01',
        status: 'online',
        metrics: {
          cpu: 28,
          memory: 50,
          disk: 21,
          network: 31,
          responseTime: 52,
        },
      },
      {
        id: 'cache-redis-02',
        status: 'online',
        metrics: {
          cpu: 26,
          memory: 48,
          disk: 20,
          network: 30,
          responseTime: 50,
        },
      },
      {
        id: 'api-prd-01',
        status: 'online',
        metrics: {
          cpu: 46,
          memory: 51,
          disk: 26,
          network: 61,
          responseTime: 205,
        },
      },
    ],
  },

  // 시간대 4: 15-19시 - 디스크 포화 장애
  {
    hour: 15,
    incident: '로그 파일 증가 시작',
    affected_servers: [
      {
        id: 'storage-nas-01',
        status: 'online',
        metrics: {
          cpu: 42,
          memory: 52,
          disk: 70,
          network: 48,
          responseTime: 155,
        },
      },
      {
        id: 'db-main-01',
        status: 'online',
        metrics: {
          cpu: 55,
          memory: 62,
          disk: 68,
          network: 43,
          responseTime: 125,
        },
      },
    ],
  },
  {
    hour: 16,
    incident: '디스크 80% 초과 경고',
    affected_servers: [
      {
        id: 'storage-nas-01',
        status: 'warning',
        metrics: {
          cpu: 48,
          memory: 58,
          disk: 82,
          network: 52,
          responseTime: 220,
        },
      },
      {
        id: 'storage-s3-gateway',
        status: 'warning',
        metrics: {
          cpu: 35,
          memory: 45,
          disk: 78,
          network: 45,
          responseTime: 180,
        },
      },
      {
        id: 'db-main-01',
        status: 'warning',
        metrics: {
          cpu: 62,
          memory: 68,
          disk: 80,
          network: 47,
          responseTime: 200,
        },
      },
      {
        id: 'backup-server-01',
        status: 'warning',
        metrics: {
          cpu: 40,
          memory: 45,
          disk: 88,
          network: 35,
          responseTime: 150,
        },
      },
    ],
  },
  {
    hour: 17,
    incident: '디스크 90% 초과 - 쓰기 작업 지연',
    affected_servers: [
      {
        id: 'storage-nas-01',
        status: 'critical',
        metrics: {
          cpu: 55,
          memory: 65,
          disk: 92,
          network: 58,
          responseTime: 2500,
          errorRate: 3,
        },
      },
      {
        id: 'storage-s3-gateway',
        status: 'critical',
        metrics: {
          cpu: 42,
          memory: 52,
          disk: 90,
          network: 50,
          responseTime: 2000,
          errorRate: 2,
        },
      },
      {
        id: 'db-main-01',
        status: 'critical',
        metrics: {
          cpu: 70,
          memory: 75,
          disk: 91,
          network: 52,
          responseTime: 3000,
          errorRate: 4,
        },
      },
      {
        id: 'backup-server-01',
        status: 'critical',
        metrics: {
          cpu: 50,
          memory: 55,
          disk: 93,
          network: 40,
          responseTime: 2200,
          errorRate: 2,
        },
      },
    ],
  },
  {
    hour: 18,
    incident: '로그 로테이션 시작 - 복구 진행 중',
    affected_servers: [
      {
        id: 'storage-nas-01',
        status: 'warning',
        metrics: {
          cpu: 48,
          memory: 58,
          disk: 75,
          network: 50,
          responseTime: 180,
        },
      },
      {
        id: 'storage-s3-gateway',
        status: 'warning',
        metrics: {
          cpu: 36,
          memory: 47,
          disk: 72,
          network: 46,
          responseTime: 160,
        },
      },
      {
        id: 'db-main-01',
        status: 'warning',
        metrics: {
          cpu: 58,
          memory: 65,
          disk: 73,
          network: 45,
          responseTime: 150,
        },
      },
      {
        id: 'backup-server-01',
        status: 'warning',
        metrics: {
          cpu: 38,
          memory: 43,
          disk: 86,
          network: 33,
          responseTime: 130,
        },
      },
    ],
  },
  {
    hour: 19,
    incident: '디스크 복구 완료',
    affected_servers: [
      {
        id: 'storage-nas-01',
        status: 'online',
        metrics: {
          cpu: 41,
          memory: 51,
          disk: 65,
          network: 46,
          responseTime: 152,
        },
      },
      {
        id: 'storage-s3-gateway',
        status: 'online',
        metrics: {
          cpu: 30,
          memory: 42,
          disk: 60,
          network: 42,
          responseTime: 140,
        },
      },
      {
        id: 'db-main-01',
        status: 'online',
        metrics: {
          cpu: 52,
          memory: 61,
          disk: 62,
          network: 41,
          responseTime: 115,
        },
      },
      {
        id: 'backup-server-01',
        status: 'online',
        metrics: {
          cpu: 36,
          memory: 41,
          disk: 84,
          network: 31,
          responseTime: 122,
        },
      },
    ],
  },

  // 시간대 5: 20-23시 - CPU 과부하 장애
  {
    hour: 20,
    incident: 'API 요청 증가 - 피크 타임 시작',
    affected_servers: [
      {
        id: 'api-prd-01',
        status: 'online',
        metrics: {
          cpu: 65,
          memory: 60,
          disk: 28,
          network: 70,
          responseTime: 250,
        },
      },
      {
        id: 'api-prd-02',
        status: 'online',
        metrics: {
          cpu: 62,
          memory: 58,
          disk: 27,
          network: 68,
          responseTime: 240,
        },
      },
      {
        id: 'web-prd-01',
        status: 'online',
        metrics: {
          cpu: 55,
          memory: 50,
          disk: 35,
          network: 60,
          responseTime: 180,
        },
      },
    ],
  },
  {
    hour: 21,
    incident: 'API 요청 2배 증가 - CPU 과부하',
    affected_servers: [
      {
        id: 'api-prd-01',
        status: 'warning',
        metrics: {
          cpu: 85,
          memory: 70,
          disk: 30,
          network: 80,
          responseTime: 600,
        },
      },
      {
        id: 'api-prd-02',
        status: 'warning',
        metrics: {
          cpu: 82,
          memory: 68,
          disk: 29,
          network: 78,
          responseTime: 580,
        },
      },
      {
        id: 'web-prd-01',
        status: 'warning',
        metrics: {
          cpu: 75,
          memory: 62,
          disk: 38,
          network: 75,
          responseTime: 350,
        },
      },
      {
        id: 'web-prd-02',
        status: 'warning',
        metrics: {
          cpu: 72,
          memory: 60,
          disk: 37,
          network: 73,
          responseTime: 340,
        },
      },
    ],
  },
  {
    hour: 22,
    incident: 'CPU 95% 초과 - 심각한 응답 지연',
    affected_servers: [
      {
        id: 'api-prd-01',
        status: 'critical',
        metrics: {
          cpu: 95,
          memory: 85,
          disk: 32,
          network: 88,
          responseTime: 3000,
          errorRate: 5,
        },
      },
      {
        id: 'api-prd-02',
        status: 'critical',
        metrics: {
          cpu: 93,
          memory: 83,
          disk: 31,
          network: 86,
          responseTime: 2800,
          errorRate: 4,
        },
      },
      {
        id: 'web-prd-01',
        status: 'critical',
        metrics: {
          cpu: 90,
          memory: 78,
          disk: 40,
          network: 85,
          responseTime: 2500,
          errorRate: 6,
        },
      },
      {
        id: 'web-prd-02',
        status: 'critical',
        metrics: {
          cpu: 88,
          memory: 76,
          disk: 39,
          network: 83,
          responseTime: 2400,
          errorRate: 5,
        },
      },
      {
        id: 'lb-main-01',
        status: 'warning',
        metrics: {
          cpu: 82,
          memory: 72,
          disk: 36,
          network: 90,
          responseTime: 150,
        },
      },
    ],
  },
  {
    hour: 23,
    incident: 'Auto-scaling 완료 - 복구',
    affected_servers: [
      {
        id: 'api-prd-01',
        status: 'online',
        metrics: {
          cpu: 55,
          memory: 65,
          disk: 29,
          network: 72,
          responseTime: 220,
        },
      },
      {
        id: 'api-prd-02',
        status: 'online',
        metrics: {
          cpu: 53,
          memory: 63,
          disk: 28,
          network: 70,
          responseTime: 215,
        },
      },
      {
        id: 'web-prd-01',
        status: 'online',
        metrics: {
          cpu: 48,
          memory: 52,
          disk: 36,
          network: 62,
          responseTime: 165,
        },
      },
      {
        id: 'web-prd-02',
        status: 'online',
        metrics: {
          cpu: 46,
          memory: 50,
          disk: 35,
          network: 60,
          responseTime: 160,
        },
      },
      {
        id: 'lb-main-01',
        status: 'online',
        metrics: {
          cpu: 52,
          memory: 56,
          disk: 34,
          network: 55,
          responseTime: 68,
        },
      },
    ],
  },
];

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 선형 보간 (Linear Interpolation)
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 시간에 맞는 장애 시나리오 찾기
 */
function getScenarioForHour(hour: number): HourlyScenario | null {
  return FAILURE_SCENARIOS.find((s) => s.hour === hour) || null;
}

/**
 * 5분 간격 데이터 생성 (12개 포인트)
 */
function generate5MinuteDataPoints(hour: number): any[] {
  const currentScenario = getScenarioForHour(hour);
  const nextHour = (hour + 1) % 24;
  const nextScenario = getScenarioForHour(nextHour);

  const dataPoints: any[] = [];

  // 5분 간격: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55분
  for (let minute = 0; minute < 60; minute += 5) {
    const timestamp = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const t = minute / 60; // 0.0 ~ 0.916 (55분/60분)

    const servers: Record<string, any> = {};

    SERVER_CONFIGS.forEach((serverConfig) => {
      const baseMetrics = ROLE_BASELINE_METRICS[serverConfig.role];

      // 현재 시간에 영향받는 서버인지 확인
      const affectedCurrent = currentScenario?.affected_servers.find(
        (s) => s.id === serverConfig.id
      );
      const affectedNext = nextScenario?.affected_servers.find(
        (s) => s.id === serverConfig.id
      );

      let metrics: ServerMetric;
      let status: ServerStatus = 'online';

      if (affectedCurrent && affectedNext) {
        // 현재와 다음 시간 모두 영향받음 → 보간
        metrics = {
          cpu: Math.round(
            lerp(affectedCurrent.metrics.cpu, affectedNext.metrics.cpu, t)
          ),
          memory: Math.round(
            lerp(affectedCurrent.metrics.memory, affectedNext.metrics.memory, t)
          ),
          disk: Math.round(
            lerp(affectedCurrent.metrics.disk, affectedNext.metrics.disk, t)
          ),
          network: Math.round(
            lerp(
              affectedCurrent.metrics.network,
              affectedNext.metrics.network,
              t
            )
          ),
          responseTime: Math.round(
            lerp(
              affectedCurrent.metrics.responseTime ||
                baseMetrics.responseTime ||
                100,
              affectedNext.metrics.responseTime ||
                baseMetrics.responseTime ||
                100,
              t
            )
          ),
        };
        // 상태는 더 심각한 것으로
        status =
          affectedCurrent.status === 'critical' ||
          affectedNext.status === 'critical'
            ? 'critical'
            : affectedCurrent.status === 'warning' ||
                affectedNext.status === 'warning'
              ? 'warning'
              : 'online';
      } else if (affectedCurrent) {
        // 현재 시간만 영향받음
        metrics = { ...affectedCurrent.metrics };
        status = affectedCurrent.status;
      } else if (affectedNext && t > 0.5) {
        // 다음 시간 영향받음 (현재 시간 후반부)
        const transitionMetrics = {
          cpu: Math.round(
            lerp(baseMetrics.cpu, affectedNext.metrics.cpu, (t - 0.5) * 2)
          ),
          memory: Math.round(
            lerp(baseMetrics.memory, affectedNext.metrics.memory, (t - 0.5) * 2)
          ),
          disk: Math.round(
            lerp(baseMetrics.disk, affectedNext.metrics.disk, (t - 0.5) * 2)
          ),
          network: Math.round(
            lerp(
              baseMetrics.network,
              affectedNext.metrics.network,
              (t - 0.5) * 2
            )
          ),
          responseTime: Math.round(
            lerp(
              baseMetrics.responseTime || 100,
              affectedNext.metrics.responseTime ||
                baseMetrics.responseTime ||
                100,
              (t - 0.5) * 2
            )
          ),
        };
        metrics = transitionMetrics;
        status = affectedNext.status;
      } else {
        // 영향받지 않음 → Baseline
        metrics = { ...baseMetrics };
        status = 'online';
      }

      servers[serverConfig.id] = {
        id: serverConfig.id,
        name: serverConfig.name,
        hostname: serverConfig.hostname,
        type: serverConfig.type,
        role: serverConfig.role,
        location: serverConfig.location,
        environment: serverConfig.environment,
        status,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        network: metrics.network,
        responseTime: metrics.responseTime || baseMetrics.responseTime,
        uptime: 2592000 + Math.floor(Math.random() * 86400),
        ip: `192.168.1.${100 + SERVER_CONFIGS.indexOf(serverConfig)}`,
        os: 'Ubuntu 22.04 LTS',
        specs: serverConfig.specs,
        services: [],
        processes: 120,
      };
    });

    dataPoints.push({
      timestamp,
      servers,
    });
  }

  return dataPoints;
}

/**
 * 24시간 JSON 파일 생성
 */
function generateHourlyJSONFiles() {
  assertLegacyMode();

  const outputDir = path.join(__dirname, '../src/data/hourly-data');

  // 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🎯 5시간대 장애 시나리오 JSON 생성 시작...\n');

  for (let hour = 0; hour < 24; hour++) {
    const scenario = getScenarioForHour(hour);
    const dataPoints = generate5MinuteDataPoints(hour);

    const hourlyData = {
      hour,
      scenario: scenario?.incident || `${hour}시 정상 운영`,
      dataPoints,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDataPoints: 12, // 5분 간격 12개
        intervalMinutes: 5,
        affectedServers: scenario?.affected_servers.length || 0,
      },
    };

    const filename = `hour-${hour.toString().padStart(2, '0')}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(hourlyData, null, 2));

    const icon = scenario?.affected_servers.some((s) => s.status === 'critical')
      ? '🔴'
      : scenario?.affected_servers.some((s) => s.status === 'warning')
        ? '🟡'
        : '🟢';

    console.log(`${icon} ${filename} - ${hourlyData.scenario}`);
  }

  console.log('\n✅ 24시간 JSON 파일 생성 완료!');
  console.log(`📁 출력 경로: ${outputDir}`);
  console.log(`📊 총 데이터: 24시간 × 12포인트 × 15서버 = 4,320 데이터 포인트`);
}

// ============================================================================
// 실행
// ============================================================================

generateHourlyJSONFiles();
