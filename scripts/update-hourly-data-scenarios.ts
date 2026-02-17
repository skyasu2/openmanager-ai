/**
 * 🎯 hourly-data JSON 파일에 시나리오 값 반영
 *
 * Dashboard와 AI Engine의 데이터 일관성을 위해
 * scenarios.ts에 정의된 장애 시나리오를 hourly-data에 직접 반영
 *
 * 업데이트 항목:
 * - 메트릭 값 (cpu, memory, disk, network)
 * - 상태 (status)
 * - 응답 시간 (responseTime) - Critical: 300-500ms, Warning: 150-250ms
 * - 로그 (logs) - 장애 관련 로그 추가
 * - 프로세스 수 (processes) - 부하에 따른 증가
 *
 * 실행: npx tsx scripts/update-hourly-data-scenarios.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// 시나리오 정의 (scenarios.ts와 동일)
interface ScenarioUpdate {
  serverId: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  peakValue: number;
  severity: 'critical' | 'warning';
  description: string;
}

interface TimeSlotScenarios {
  hours: number[]; // 적용할 시간대
  scenarios: ScenarioUpdate[];
}

// 로그 템플릿
interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
}

// 24시간 4분할 시나리오 매핑
const TIME_SLOT_SCENARIOS: TimeSlotScenarios[] = [
  // 시간대 1: 00:00-06:00 (심야/새벽)
  {
    hours: [0, 1, 2, 3, 4, 5],
    scenarios: [
      { serverId: 'db-mysql-dc1-primary', metric: 'disk', peakValue: 92, severity: 'critical', description: '새벽 자동 백업 + 바이너리 로그 누적으로 디스크 위험' },
      { serverId: 'web-nginx-dc1-01', metric: 'cpu', peakValue: 78, severity: 'warning', description: '새벽 배치 크론 작업으로 CPU 증가' },
      { serverId: 'cache-redis-dc1-01', metric: 'memory', peakValue: 88, severity: 'warning', description: 'Redis 캐시 메모리 누적으로 경고 수준' },
    ],
  },
  // 시간대 2: 06:00-12:00 (오전)
  {
    hours: [6, 7, 8, 9, 10, 11],
    scenarios: [
      { serverId: 'api-was-dc1-02', metric: 'memory', peakValue: 94, severity: 'critical', description: '출근 시간대 API 트래픽 급증으로 JVM 힙 메모리 누수' },
      { serverId: 'web-nginx-dc1-02', metric: 'cpu', peakValue: 78, severity: 'warning', description: '출근 피크 시간 Nginx worker CPU 급증' },
      { serverId: 'lb-haproxy-dc1-01', metric: 'cpu', peakValue: 75, severity: 'warning', description: '트래픽 분산 처리로 로드밸런서 CPU 증가' },
    ],
  },
  // 시간대 3: 12:00-18:00 (오후)
  {
    hours: [12, 13, 14, 15, 16, 17],
    scenarios: [
      { serverId: 'web-nginx-dc1-03', metric: 'memory', peakValue: 91, severity: 'critical', description: '오후 트래픽 집중으로 Nginx worker 메모리 누수' },
      { serverId: 'storage-nfs-dc1-01', metric: 'disk', peakValue: 86, severity: 'warning', description: '업무 시간 파일 업로드 누적으로 디스크 증가' },
      { serverId: 'api-was-dc1-01', metric: 'cpu', peakValue: 79, severity: 'warning', description: '오후 API 요청 처리로 CPU 증가' },
    ],
  },
  // 시간대 4: 18:00-24:00 (저녁/밤)
  {
    hours: [18, 19, 20, 21, 22, 23],
    scenarios: [
      { serverId: 'cache-redis-dc1-02', metric: 'memory', peakValue: 96, severity: 'critical', description: '저녁 피크 타임 캐시 히트율 증가로 메모리 위험' },
      { serverId: 'db-mysql-dc1-replica', metric: 'disk', peakValue: 82, severity: 'warning', description: '하루 트랜잭션 로그 누적으로 디스크 증가' },
      { serverId: 'lb-haproxy-dc1-02', metric: 'cpu', peakValue: 76, severity: 'warning', description: '저녁 SSL termination + health check 오버헤드' },
    ],
  },
];

// 네트워크 시나리오에서 CPU/Memory로 변경된 서버들의 네트워크 baseline 값
// 이전 네트워크 시나리오 값(82%, 93%)을 정상 값으로 리셋
const NETWORK_RESET_SERVERS: Record<string, { hours: number[]; baselineNetwork: number }> = {
  'web-nginx-dc1-02': { hours: [6, 7, 8, 9, 10, 11], baselineNetwork: 55 },      // 06-12시
  'web-nginx-dc1-03': { hours: [12, 13, 14, 15, 16, 17], baselineNetwork: 45 },  // 12-18시
  'lb-haproxy-dc1-02': { hours: [18, 19, 20, 21, 22, 23], baselineNetwork: 65 }, // 18-24시
};

// 로그 메시지 생성
function generateLogs(scenario: ScenarioUpdate, hour: number, minute: number): LogEntry[] {
  const timestamp = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
  const logs: LogEntry[] = [];

  if (scenario.severity === 'critical') {
    logs.push({
      timestamp,
      level: 'ERROR',
      message: `[CRITICAL] ${scenario.metric.toUpperCase()} usage reached ${scenario.peakValue}% - ${scenario.description}`,
    });
    logs.push({
      timestamp: `${hour.toString().padStart(2, '0')}:${(minute + 1).toString().padStart(2, '0')}:00`,
      level: 'WARN',
      message: `[ALERT] Threshold exceeded: ${scenario.metric} > 90%. Immediate action required.`,
    });
  } else {
    logs.push({
      timestamp,
      level: 'WARN',
      message: `[WARNING] ${scenario.metric.toUpperCase()} usage at ${scenario.peakValue}% - ${scenario.description}`,
    });
  }

  return logs;
}

// 응답 시간 계산
function calculateResponseTime(severity: 'critical' | 'warning', baseResponseTime: number): number {
  if (severity === 'critical') {
    return Math.max(baseResponseTime, 350 + Math.floor(Math.random() * 150)); // 350-500ms
  }
  return Math.max(baseResponseTime, 180 + Math.floor(Math.random() * 70)); // 180-250ms
}

// 프로세스 수 계산
function calculateProcesses(metric: string, peakValue: number, baseProcesses: number): number {
  if (metric === 'memory' && peakValue > 90) {
    return Math.max(baseProcesses, 180 + Math.floor(Math.random() * 40)); // 180-220
  }
  if (metric === 'cpu' && peakValue > 75) {
    return Math.max(baseProcesses, 160 + Math.floor(Math.random() * 30)); // 160-190
  }
  return baseProcesses;
}

// 서비스 상태 생성
interface ServiceStatus {
  name: string;
  status: 'running' | 'degraded' | 'stopped';
  health: 'healthy' | 'warning' | 'critical';
  message?: string;
}

function generateServices(scenario: ScenarioUpdate, serverType: string): ServiceStatus[] {
  const services: ServiceStatus[] = [];

  // 서버 타입별 기본 서비스
  const serviceMap: Record<string, string[]> = {
    cache: ['redis-server', 'redis-sentinel'],
    database: ['mysqld', 'mysql-router'],
    web: ['nginx', 'php-fpm'],
    application: ['java', 'tomcat'],
    loadbalancer: ['haproxy', 'keepalived'],
    storage: ['nfs-server', 'rpcbind'],
  };

  const baseServices = serviceMap[serverType] || ['main-service'];

  for (const svc of baseServices) {
    if (scenario.severity === 'critical') {
      services.push({
        name: svc,
        status: 'degraded',
        health: 'critical',
        message: `High ${scenario.metric} usage affecting ${svc}`,
      });
    } else {
      services.push({
        name: svc,
        status: 'running',
        health: 'warning',
        message: `Elevated ${scenario.metric} usage`,
      });
    }
  }

  return services;
}

// LEGACY 보호 가드:
// 이 스크립트는 src/data/hourly-data(구형 포맷) 전용입니다.
// 현재 기본 파이프라인은 public/data/otel-data를 사용하므로,
// 의도치 않은 실행으로 precomputed-states.json이 오염되지 않도록 기본 차단합니다.
const LEGACY_GUARD_ENV = 'ALLOW_LEGACY_HOURLY_DATA';

// hourly-data 디렉토리 경로
const HOURLY_DATA_DIR = path.join(__dirname, '../src/data/hourly-data');

function assertLegacyMode(): void {
  if (process.env[LEGACY_GUARD_ENV] !== 'true') {
    throw new Error(
      [
        '[BLOCKED] Legacy hourly-data generator is disabled by default.',
        `Set ${LEGACY_GUARD_ENV}=true only when you intentionally maintain src/data/hourly-data.`,
        'Current primary pipeline: public/data/otel-data (see scripts/data/otel-fix.ts, scripts/data/otel-verify.ts).',
      ].join('\n')
    );
  }

  if (!fs.existsSync(HOURLY_DATA_DIR)) {
    throw new Error(
      [
        `[BLOCKED] Missing legacy directory: ${HOURLY_DATA_DIR}`,
        'This script cannot run safely without src/data/hourly-data.',
        'Use OTel pipeline scripts instead: npm run data:fix && npm run data:verify',
      ].join('\n')
    );
  }
}

// 시나리오를 적용할 시간대 찾기
function getScenariosForHour(hour: number): ScenarioUpdate[] {
  const slot = TIME_SLOT_SCENARIOS.find((s) => s.hours.includes(hour));
  return slot?.scenarios || [];
}

// 단일 hourly-data 파일 업데이트
function updateHourlyDataFile(hour: number): void {
  const filePath = path.join(HOURLY_DATA_DIR, `hour-${hour.toString().padStart(2, '0')}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[SKIP] ${filePath} 파일 없음`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  const scenarios = getScenariosForHour(hour);
  if (scenarios.length === 0) {
    console.log(`[SKIP] hour-${hour}: 시나리오 없음`);
    return;
  }

  let updated = false;

  // 각 dataPoint의 servers 업데이트
  for (const dataPoint of data.dataPoints) {
    if (!dataPoint.servers) continue;
    const minute = dataPoint.minute || 0;

    for (const scenario of scenarios) {
      const server = dataPoint.servers[scenario.serverId];
      if (!server) {
        console.warn(`[WARN] hour-${hour}: ${scenario.serverId} 서버 없음`);
        continue;
      }

      // 1. 메트릭 값 업데이트
      if (server[scenario.metric] !== scenario.peakValue) {
        server[scenario.metric] = scenario.peakValue;
        updated = true;
      }

      // 2. 상태 업데이트
      const newStatus = scenario.severity === 'critical' ? 'critical' : 'warning';
      if (server.status !== newStatus) {
        server.status = newStatus;
        updated = true;
      }

      // 3. 응답 시간 업데이트 (일관된 값 사용)
      const baseResponseTime = server.responseTime || 100;
      const newResponseTime = scenario.severity === 'critical'
        ? 380 + (hour % 3) * 40  // 380-460ms (deterministic)
        : 200 + (hour % 3) * 25; // 200-250ms (deterministic)
      if (server.responseTime < newResponseTime) {
        server.responseTime = newResponseTime;
        updated = true;
      }

      // 4. 프로세스 수 업데이트 (deterministic)
      const baseProcesses = server.processes || 100;
      let newProcesses = baseProcesses;
      if (scenario.metric === 'memory' && scenario.peakValue > 90) {
        newProcesses = 195 + (hour % 5); // 195-199
      } else if (scenario.metric === 'cpu' && scenario.peakValue > 75) {
        newProcesses = 175 + (hour % 5); // 175-179
      }
      if (server.processes < newProcesses) {
        server.processes = newProcesses;
        updated = true;
      }

      // 5. 로그 업데이트
      const logs = generateLogs(scenario, hour, minute);
      if (!server.logs || server.logs.length === 0) {
        server.logs = logs;
        updated = true;
      } else if (JSON.stringify(server.logs) !== JSON.stringify(logs)) {
        server.logs = logs;
        updated = true;
      }

      // 6. 서비스 상태 업데이트
      const serverType = server.type || 'application';
      const services = generateServices(scenario, serverType);
      if (!server.services || server.services.length === 0 || JSON.stringify(server.services) !== JSON.stringify(services)) {
        server.services = services;
        updated = true;
      }
    }

    // 7. 네트워크 시나리오 → CPU/Memory 변경된 서버들의 네트워크 값 리셋
    for (const [serverId, config] of Object.entries(NETWORK_RESET_SERVERS)) {
      if (config.hours.includes(hour)) {
        const server = dataPoint.servers[serverId];
        if (server && server.network > config.baselineNetwork + 10) {
          server.network = config.baselineNetwork + Math.floor(Math.random() * 5);
          updated = true;
        }
      }
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[OK] hour-${hour.toString().padStart(2, '0')}.json 업데이트됨`);
    for (const s of scenarios) {
      console.log(`     - ${s.serverId}: ${s.metric}=${s.peakValue}% (${s.severity})`);
      console.log(`       → responseTime, processes, logs 연관 메트릭 반영`);
    }
  } else {
    console.log(`[OK] hour-${hour.toString().padStart(2, '0')}.json 변경 없음 (이미 최신)`);
  }
}

// precomputed-states.json 재생성
function regeneratePrecomputedStates(): void {
  const precomputedPath = path.join(__dirname, '../cloud-run/ai-engine/data/precomputed-states.json');

  // precomputed-state.ts에서 빌드 함수 동적 임포트 시도
  try {
    // 간단한 재빌드: hourly-data를 읽어서 슬롯 데이터 생성
    const slots: any[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourlyPath = path.join(HOURLY_DATA_DIR, `hour-${hour.toString().padStart(2, '0')}.json`);
      if (!fs.existsSync(hourlyPath)) continue;

      const hourlyData = JSON.parse(fs.readFileSync(hourlyPath, 'utf-8'));

      // 6개 슬롯 (10분 간격)
      for (let slotInHour = 0; slotInHour < 6; slotInHour++) {
        const slotIndex = hour * 6 + slotInHour;
        const minuteOfDay = slotIndex * 10;
        const timeLabel = `${hour.toString().padStart(2, '0')}:${(slotInHour * 10).toString().padStart(2, '0')}`;

        const dataPointIndex = slotInHour * 2;
        const dataPoint = hourlyData.dataPoints[Math.min(dataPointIndex, hourlyData.dataPoints.length - 1)];

        if (!dataPoint?.servers) continue;

        const servers = Object.values(dataPoint.servers).map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          status: determineStatusFromMetrics(s),
          cpu: s.cpu,
          memory: s.memory,
          disk: s.disk,
          network: s.network,
        }));

        const summary = {
          total: servers.length,
          healthy: servers.filter((s: any) => s.status === 'healthy').length,
          warning: servers.filter((s: any) => s.status === 'warning').length,
          critical: servers.filter((s: any) => s.status === 'critical').length,
        };

        const alerts = generateAlertsFromServers(Object.values(dataPoint.servers));

        slots.push({
          slotIndex,
          timeLabel,
          minuteOfDay,
          summary,
          alerts,
          activePatterns: detectPatterns(servers),
          servers,
        });
      }
    }

    if (slots.length !== 144) {
      throw new Error(
        `[BLOCKED] precomputed-states 재생성 결과가 비정상입니다 (slots=${slots.length}, expected=144). 쓰기 중단`
      );
    }

    fs.writeFileSync(precomputedPath, JSON.stringify(slots, null, 2), 'utf-8');
    console.log(`[OK] precomputed-states.json 재생성 완료 (${slots.length}개 슬롯)`);
  } catch (e) {
    console.warn('[WARN] precomputed-states.json 재생성 실패:', e);
  }
}

// 메트릭 기반 상태 결정 (THRESHOLDS와 동일)
function determineStatusFromMetrics(server: any): 'healthy' | 'warning' | 'critical' {
  const THRESHOLDS = {
    cpu: { warning: 80, critical: 90 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 90 },
    network: { warning: 70, critical: 85 },
  };

  if (
    server.cpu >= THRESHOLDS.cpu.critical ||
    server.memory >= THRESHOLDS.memory.critical ||
    server.disk >= THRESHOLDS.disk.critical ||
    server.network >= THRESHOLDS.network.critical
  ) {
    return 'critical';
  }

  if (
    server.cpu >= THRESHOLDS.cpu.warning ||
    server.memory >= THRESHOLDS.memory.warning ||
    server.disk >= THRESHOLDS.disk.warning ||
    server.network >= THRESHOLDS.network.warning
  ) {
    return 'warning';
  }

  return 'healthy';
}

// 서버 목록에서 알림 생성
function generateAlertsFromServers(servers: any[]): any[] {
  const THRESHOLDS = {
    cpu: { warning: 80, critical: 90 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 90 },
    network: { warning: 70, critical: 85 },
  };

  const alerts: any[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const server of servers) {
    for (const metric of metrics) {
      const value = server[metric];
      const threshold = THRESHOLDS[metric];

      if (value >= threshold.critical) {
        alerts.push({
          serverId: server.id,
          serverName: server.name,
          serverType: server.type,
          metric,
          value,
          threshold: threshold.critical,
          trend: 'stable',
          severity: 'critical',
        });
      } else if (value >= threshold.warning) {
        alerts.push({
          serverId: server.id,
          serverName: server.name,
          serverType: server.type,
          metric,
          value,
          threshold: threshold.warning,
          trend: 'stable',
          severity: 'warning',
        });
      }
    }
  }

  return alerts;
}

// 패턴 감지
function detectPatterns(servers: any[]): any[] {
  const THRESHOLDS = {
    cpu: { warning: 80, critical: 90 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 90 },
    network: { warning: 70, critical: 85 },
  };

  const patterns: any[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const metric of metrics) {
    const values = servers.map((s) => s[metric]);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);

    if (max >= THRESHOLDS[metric].critical) {
      patterns.push({
        metric,
        pattern: max - avg > 30 ? 'spike' : 'sustained',
        severity: 'critical',
      });
    } else if (max >= THRESHOLDS[metric].warning) {
      patterns.push({
        metric,
        pattern: 'gradual',
        severity: 'warning',
      });
    }
  }

  return patterns;
}

// 메인 실행
function main(): void {
  assertLegacyMode();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 hourly-data 시나리오 값 반영 시작');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  for (let hour = 0; hour < 24; hour++) {
    updateHourlyDataFile(hour);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 AI Engine precomputed-states.json 재생성 중...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  regeneratePrecomputedStates();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 완료! Dashboard와 AI Engine 데이터가 일치합니다.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main();
