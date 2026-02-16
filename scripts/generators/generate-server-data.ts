#!/usr/bin/env tsx

/**
 * Vercel JSON 24시간 서버 데이터 생성기
 *
 * 목적: 10분 간격 현실적인 서버 메트릭 데이터 생성
 * - 24개 시간별 파일 (hour-00.json ~ hour-23.json)
 * - 각 파일당 6개 데이터 포인트 (00:00, 00:10, ..., 00:50)
 * - SERVER_TYPE_DEFINITIONS 기반 현실적인 특성
 * - 시나리오 기반 장애 시뮬레이션
 */

import fs from 'fs';
import path from 'path';

const LEGACY_GUARD_ENV = 'ALLOW_LEGACY_PUBLIC_SERVER_DATA';

function assertLegacyMode(): void {
  if (process.env[LEGACY_GUARD_ENV] !== 'true') {
    throw new Error(
      [
        '[BLOCKED] Legacy public/data server generator is disabled by default.',
        `Set ${LEGACY_GUARD_ENV}=true only when regenerating public/data/servers/hourly on purpose.`,
        'Primary monitoring dataset uses src/data/otel-data.',
      ].join('\n')
    );
  }
}

// ==========================================
// 서버 타입 정의 (src/types/server.ts 기반)
// ==========================================

type ServerRole =
  | 'web'
  | 'api'
  | 'database'
  | 'cache'
  | 'storage'
  | 'load-balancer'
  | 'backup'
  | 'monitoring'
  | 'security'
  | 'queue'
  | 'app'
  | 'fallback';

type ServerStatus = 'online' | 'warning' | 'critical' | 'offline';

interface ServerCharacteristics {
  cpuWeight: number;
  memoryWeight: number;
  diskWeight: number;
  networkWeight: number;
  responseTimeBase: number;
  stabilityFactor: number;
}

interface ServerTypeDefinition {
  type: ServerRole;
  tags: string[];
  characteristics: ServerCharacteristics;
  failureProne: string[];
  dependencies: ServerRole[];
}

const SERVER_TYPE_DEFINITIONS: Record<ServerRole, ServerTypeDefinition> = {
  web: {
    type: 'web',
    tags: ['nginx', 'apache', 'frontend', 'http'],
    characteristics: {
      cpuWeight: 0.7,
      memoryWeight: 0.5,
      diskWeight: 0.3,
      networkWeight: 1.2,
      responseTimeBase: 120,
      stabilityFactor: 0.8,
    },
    failureProne: ['high_traffic', 'ssl_issues', 'frontend_errors'],
    dependencies: ['api', 'cache'],
  },
  api: {
    type: 'api',
    tags: ['node', 'nginx', 'express', 'fastapi', 'rest', 'graphql'],
    characteristics: {
      cpuWeight: 0.8,
      memoryWeight: 0.6,
      diskWeight: 0.4,
      networkWeight: 1.0,
      responseTimeBase: 200,
      stabilityFactor: 0.7,
    },
    failureProne: ['memory_leak', 'connection_timeout', 'rate_limit'],
    dependencies: ['database', 'cache'],
  },
  database: {
    type: 'database',
    tags: ['postgres', 'mysql', 'mongodb', 'read/write_heavy'],
    characteristics: {
      cpuWeight: 0.6,
      memoryWeight: 0.9,
      diskWeight: 1.0,
      networkWeight: 0.8,
      responseTimeBase: 50,
      stabilityFactor: 0.9,
    },
    failureProne: ['disk_full', 'slow_queries', 'connection_pool_exhausted'],
    dependencies: ['storage'],
  },
  cache: {
    type: 'cache',
    tags: ['redis', 'memcached', 'in-memory'],
    characteristics: {
      cpuWeight: 0.4,
      memoryWeight: 1.2,
      diskWeight: 0.2,
      networkWeight: 1.1,
      responseTimeBase: 20,
      stabilityFactor: 0.8,
    },
    failureProne: ['memory_eviction', 'cache_miss_spike'],
    dependencies: [],
  },
  storage: {
    type: 'storage',
    tags: ['nfs', 'netapp', 'slow_iops', 'backup'],
    characteristics: {
      cpuWeight: 0.3,
      memoryWeight: 0.4,
      diskWeight: 1.2,
      networkWeight: 0.6,
      responseTimeBase: 500,
      stabilityFactor: 0.6,
    },
    failureProne: ['disk_full', 'io_bottleneck', 'hardware_failure'],
    dependencies: [],
  },
  'load-balancer': {
    type: 'load-balancer',
    tags: ['nginx', 'haproxy', 'traefik', 'ingress'],
    characteristics: {
      cpuWeight: 0.6,
      memoryWeight: 0.4,
      diskWeight: 0.2,
      networkWeight: 1.3,
      responseTimeBase: 80,
      stabilityFactor: 0.8,
    },
    failureProne: ['backend_unavailable', 'ssl_certificate_expired'],
    dependencies: ['web', 'api'],
  },
  backup: {
    type: 'backup',
    tags: ['backup', 'archive', 'scheduled'],
    characteristics: {
      cpuWeight: 0.4,
      memoryWeight: 0.3,
      diskWeight: 1.1,
      networkWeight: 0.7,
      responseTimeBase: 1000,
      stabilityFactor: 0.9,
    },
    failureProne: ['backup_failure', 'storage_corruption'],
    dependencies: ['storage', 'database'],
  },
  monitoring: {
    type: 'monitoring',
    tags: ['prometheus', 'grafana', 'metrics', 'logging'],
    characteristics: {
      cpuWeight: 0.5,
      memoryWeight: 0.6,
      diskWeight: 0.8,
      networkWeight: 0.9,
      responseTimeBase: 300,
      stabilityFactor: 0.85,
    },
    failureProne: ['disk_space', 'network_issues'],
    dependencies: [],
  },
  security: {
    type: 'security',
    tags: ['firewall', 'auth', 'ssl', 'security'],
    characteristics: {
      cpuWeight: 0.3,
      memoryWeight: 0.4,
      diskWeight: 0.5,
      networkWeight: 1.1,
      responseTimeBase: 100,
      stabilityFactor: 0.9,
    },
    failureProne: ['cert_expiry', 'auth_failure'],
    dependencies: [],
  },
  queue: {
    type: 'queue',
    tags: ['redis', 'rabbitmq', 'queue', 'jobs'],
    characteristics: {
      cpuWeight: 0.6,
      memoryWeight: 0.7,
      diskWeight: 0.4,
      networkWeight: 0.8,
      responseTimeBase: 50,
      stabilityFactor: 0.8,
    },
    failureProne: ['queue_overflow', 'worker_timeout'],
    dependencies: [],
  },
  app: {
    type: 'app',
    tags: ['application', 'service', 'microservice', 'app'],
    characteristics: {
      cpuWeight: 0.7,
      memoryWeight: 0.6,
      diskWeight: 0.5,
      networkWeight: 0.9,
      responseTimeBase: 150,
      stabilityFactor: 0.7,
    },
    failureProne: ['application_crash', 'memory_leak', 'timeout'],
    dependencies: ['api', 'database'],
  },
  fallback: {
    type: 'fallback',
    tags: ['backup', 'secondary', 'emergency', 'fallback'],
    characteristics: {
      cpuWeight: 0.8,
      memoryWeight: 0.7,
      diskWeight: 0.6,
      networkWeight: 1.0,
      responseTimeBase: 250,
      stabilityFactor: 0.9,
    },
    failureProne: ['backup_system_overload', 'fallback_activation'],
    dependencies: ['api', 'database'],
  },
};

// ==========================================
// 서버 목록 (supabase schema 기반)
// ==========================================

interface ServerInfo {
  id: string;
  name: string;
  type: ServerRole;
}

const SERVERS: ServerInfo[] = [
  // Web Servers (3)
  { id: 'web-prod-01', name: 'Web Server 1', type: 'web' },
  { id: 'web-prod-02', name: 'Web Server 2', type: 'web' },
  { id: 'web-prod-03', name: 'Web Server 3', type: 'web' },

  // API Servers (2)
  { id: 'api-prod-01', name: 'API Server 1', type: 'api' },
  { id: 'api-prod-02', name: 'API Server 2', type: 'api' },

  // Database Servers (2)
  { id: 'db-prod-01', name: 'Database Primary', type: 'database' },
  { id: 'db-prod-02', name: 'Database Replica', type: 'database' },

  // Cache Servers (2)
  { id: 'cache-prod-01', name: 'Redis Cache 1', type: 'cache' },
  { id: 'cache-prod-02', name: 'Redis Cache 2', type: 'cache' },

  // Storage (1)
  { id: 'storage-prod-01', name: 'Storage Server', type: 'storage' },

  // Infrastructure (6)
  { id: 'lb-prod-01', name: 'Load Balancer', type: 'load-balancer' },
  { id: 'backup-prod-01', name: 'Backup Server', type: 'backup' },
  { id: 'monitoring-prod-01', name: 'Monitoring', type: 'monitoring' },
  { id: 'security-prod-01', name: 'Security Gateway', type: 'security' },
  { id: 'queue-prod-01', name: 'Message Queue', type: 'queue' },
  { id: 'app-prod-01', name: 'App Server', type: 'app' },
  { id: 'fallback-prod-01', name: 'Fallback', type: 'fallback' },
];

// ==========================================
// 메트릭 생성 로직
// ==========================================

/**
 * 기본 메트릭 생성 (normalRange 기반)
 */
function generateBaseMetric(weight: number, baseValue: number = 50): number {
  // weight에 따라 기본 사용률 조정
  const weightedBase = baseValue * weight;
  // ±10% 무작위 변동
  const variation = (Math.random() - 0.5) * 20;
  return Math.max(0, Math.min(100, weightedBase + variation));
}

/**
 * 시나리오 적용 (장애 상황 시뮬레이션)
 */
function applyScenario(
  baseMetrics: { cpu: number; memory: number; disk: number; network: number },
  type: ServerRole,
  hour: number
): {
  metrics: { cpu: number; memory: number; disk: number; network: number };
  status: ServerStatus;
  scenario?: string;
} {
  const typeDef = SERVER_TYPE_DEFINITIONS[type];

  // 시간대별 시나리오 확률 (피크 타임 반영)
  const isPeakHour = (hour >= 9 && hour <= 18); // 업무 시간
  const scenarioProbability = isPeakHour ? 0.15 : 0.05; // 피크 타임 15%, 일반 5%

  if (Math.random() > scenarioProbability) {
    // 정상 상태
    return {
      metrics: baseMetrics,
      status: 'online',
    };
  }

  // 장애 시나리오 적용
  const scenario = typeDef.failureProne[
    Math.floor(Math.random() * typeDef.failureProne.length)
  ];

  const adjustedMetrics = { ...baseMetrics };
  let status: ServerStatus = 'online';

  // 시나리오별 메트릭 조정
  switch (scenario) {
    case 'high_traffic':
    case 'connection_timeout':
      adjustedMetrics.cpu += 20;
      adjustedMetrics.network += 30;
      status = adjustedMetrics.cpu > 85 ? 'critical' : 'warning';
      break;

    case 'memory_leak':
    case 'memory_eviction':
      adjustedMetrics.memory += 25;
      status = adjustedMetrics.memory > 90 ? 'critical' : 'warning';
      break;

    case 'disk_full':
    case 'slow_queries':
      adjustedMetrics.disk += 20;
      adjustedMetrics.cpu += 10;
      status = adjustedMetrics.disk > 85 ? 'critical' : 'warning';
      break;

    case 'io_bottleneck':
    case 'hardware_failure':
      adjustedMetrics.disk += 15;
      adjustedMetrics.cpu += 15;
      status = 'critical';
      break;

    default:
      adjustedMetrics.cpu += 15;
      status = 'warning';
  }

  // 범위 보정
  adjustedMetrics.cpu = Math.min(100, adjustedMetrics.cpu);
  adjustedMetrics.memory = Math.min(100, adjustedMetrics.memory);
  adjustedMetrics.disk = Math.min(100, adjustedMetrics.disk);
  adjustedMetrics.network = Math.min(100, adjustedMetrics.network);

  return {
    metrics: adjustedMetrics,
    status,
    scenario,
  };
}

/**
 * 서버별 메트릭 생성
 */
function generateServerMetrics(
  server: ServerInfo,
  hour: number,
  minute: number
): {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status: ServerStatus;
  responseTime: number;
  uptime: number;
  scenario?: string;
} {
  const typeDef = SERVER_TYPE_DEFINITIONS[server.type];
  const { characteristics } = typeDef;

  // 기본 메트릭 생성
  const baseMetrics = {
    cpu: generateBaseMetric(characteristics.cpuWeight),
    memory: generateBaseMetric(characteristics.memoryWeight),
    disk: generateBaseMetric(characteristics.diskWeight, 60), // 디스크는 평균 60%
    network: generateBaseMetric(characteristics.networkWeight),
  };

  // 시나리오 적용
  const { metrics, status, scenario } = applyScenario(baseMetrics, server.type, hour);

  // 응답 시간 계산 (status에 따라 가중)
  const responseTimeMultiplier = status === 'critical' ? 2.5 : status === 'warning' ? 1.5 : 1.0;
  const responseTime = Math.round(
    characteristics.responseTimeBase * responseTimeMultiplier * (0.8 + Math.random() * 0.4)
  );

  // 가동 시간 (99.9% uptime 기준 - 24시간 = 86,400초, 0.1% = 86초 다운타임)
  const uptimeSeconds = status === 'critical'
    ? 86400 - Math.floor(Math.random() * 200) // critical: 최대 200초 다운
    : status === 'warning'
    ? 86400 - Math.floor(Math.random() * 50) // warning: 최대 50초 다운
    : 86400; // online: 완전 가동

  return {
    ...metrics,
    status,
    responseTime,
    uptime: uptimeSeconds,
    ...(scenario && { scenario }),
  };
}

/**
 * 시간별 데이터 생성
 */
function generateHourlyData(hour: number) {
  const dataPoints = [];

  // 6개 데이터 포인트 (00, 10, 20, 30, 40, 50분)
  for (let minute = 0; minute < 60; minute += 10) {
    const timestamp = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    const servers: Record<string, any> = {};

    SERVERS.forEach(server => {
      servers[server.id] = generateServerMetrics(server, hour, minute);
    });

    dataPoints.push({
      timestamp,
      servers,
    });
  }

  return {
    hour,
    generatedAt: new Date().toISOString(),
    dataPoints,
  };
}

// ==========================================
// 메인 로직
// ==========================================

function main() {
  assertLegacyMode();

  console.log('📊 Vercel JSON 24시간 서버 데이터 생성 시작...\n');

  // 출력 디렉토리
  const outputDir = path.join(process.cwd(), 'public', 'data', 'servers', 'hourly');

  // 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ 디렉토리 생성: ${outputDir}\n`);
  }

  let totalSize = 0;

  // 24시간 데이터 생성
  for (let hour = 0; hour < 24; hour++) {
    const data = generateHourlyData(hour);
    const filename = `hour-${hour.toString().padStart(2, '0')}.json`;
    const filepath = path.join(outputDir, filename);

    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, jsonContent);

    const fileSize = Buffer.byteLength(jsonContent, 'utf8');
    totalSize += fileSize;

    console.log(`  ✅ ${filename} (${(fileSize / 1024).toFixed(1)}KB)`);
  }

  console.log(`\n📦 총 크기: ${(totalSize / 1024).toFixed(1)}KB`);
  console.log(`📁 저장 위치: ${outputDir}`);
  console.log('\n🎉 데이터 생성 완료!\n');

  // 통계 출력
  console.log('📈 생성 통계:');
  console.log(`  - 시간별 파일: 24개`);
  console.log(`  - 데이터 포인트/파일: 6개 (10분 간격)`);
  console.log(`  - 서버 수: ${SERVERS.length}개`);
  console.log(`  - 총 데이터 포인트: ${24 * 6 * SERVERS.length}개`);
  console.log(`  - 평균 파일 크기: ${(totalSize / 24 / 1024).toFixed(1)}KB\n`);
}

// 실행
if (require.main === module) {
  main();
}
