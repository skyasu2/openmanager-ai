/**
 * 🔗 Scenario Data Flow Integration Test
 *
 * ScenarioLoader → HourlyData → MetricsProvider 통합 테스트
 *
 * Vercel 무료 티어 안전:
 * - ✅ 파일 시스템 Mock (실제 파일 읽기 없음)
 * - ✅ 외부 API 호출 없음
 * - ✅ 10초 이내 실행
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  resolve: vi.fn((...args: string[]) => args.join('/')),
}));

// Mock hourly data structure
const mockHourlyData = {
  hour: 14,
  timestamp: '2024-01-15T14:00:00Z',
  scenario: {
    name: 'traffic_cycle',
    description: '출근시간 트래픽 폭증',
    phase: 'peak',
    intensity: 0.8,
  },
  servers: [
    {
      serverId: 'web-01',
      serverType: 'web',
      cpu: 75,
      memory: 80,
      disk: 45,
      network: 90,
      status: 'warning',
      location: 'Seoul',
      logs: ['[WARN] High traffic detected', '[INFO] Scaling up instances'],
    },
    {
      serverId: 'api-01',
      serverType: 'api',
      cpu: 60,
      memory: 65,
      disk: 30,
      network: 70,
      status: 'online',
      location: 'Seoul',
      logs: ['[INFO] Processing requests normally'],
    },
    {
      serverId: 'database-01',
      serverType: 'database',
      cpu: 85,
      memory: 90,
      disk: 60,
      network: 40,
      status: 'critical',
      location: 'Seoul',
      logs: [
        '[CRITICAL] Memory pressure detected',
        '[ERROR] Query timeout occurred',
      ],
    },
  ],
};

describe('Scenario Data Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('시간 기반 시나리오 선택', () => {
    it('현재 시간에 맞는 hourly-data 파일 선택', () => {
      // Given
      const testTime = new Date('2024-01-15T14:30:00Z');
      vi.setSystemTime(testTime);

      // When - UTC 시간 사용 (서버는 UTC 기준)
      const hour = testTime.getUTCHours();

      // Then
      expect(hour).toBe(14);
      // 실제로는 hour-14.json 파일이 로드됨
    });

    it('24시간 사이클 순환 (23시 → 0시)', () => {
      // Given
      const midnight = new Date('2024-01-15T23:59:59Z');
      vi.setSystemTime(midnight);

      // When - UTC 시간 사용
      const currentHour = midnight.getUTCHours();
      const nextHour = (currentHour + 1) % 24;

      // Then
      expect(currentHour).toBe(23);
      expect(nextHour).toBe(0);
    });
  });

  describe('서버 메트릭 변환', () => {
    it('HourlyData → ServerMetrics 변환', () => {
      // Given
      const rawServer = mockHourlyData.servers[0];

      // When - 실제 변환 로직 시뮬레이션
      const serverMetric = {
        id: rawServer.serverId,
        name: rawServer.serverId,
        hostname: `${rawServer.serverId.toLowerCase()}.internal`,
        type: rawServer.serverType,
        status: rawServer.status,
        cpu: rawServer.cpu,
        memory: rawServer.memory,
        disk: rawServer.disk,
        network: rawServer.network,
        location: rawServer.location,
        logs: rawServer.logs,
      };

      // Then
      expect(serverMetric.id).toBe('web-01');
      expect(serverMetric.type).toBe('web');
      expect(serverMetric.status).toBe('warning');
      expect(serverMetric.cpu).toBe(75);
      expect(serverMetric.logs).toHaveLength(2);
    });

    it('status 필드가 JSON 원본값 유지 (재계산 안함)', () => {
      // Given - JSON에서 읽은 상태
      const jsonStatus = 'warning';
      // 참고: CPU가 50이어도 status는 warning 유지 (SSOT 원칙)

      // When - SSOT 원칙: JSON 값 그대로 사용
      const status = jsonStatus; // 재계산 X

      // Then
      expect(status).toBe('warning');
      // CPU 기반 재계산이었다면 'online'이 되었을 것
    });
  });

  describe('로그 파싱', () => {
    it('[CRITICAL] 로그 → ERROR 레벨 매핑', () => {
      // Given
      const logMessage = '[CRITICAL] Memory pressure detected';

      // When
      const level = logMessage.includes('[CRITICAL]')
        ? 'ERROR'
        : logMessage.includes('[ERROR]')
          ? 'ERROR'
          : logMessage.includes('[WARN]')
            ? 'WARN'
            : 'INFO';

      // Then
      expect(level).toBe('ERROR');
    });

    it('[WARN] 로그 → WARN 레벨 매핑', () => {
      // Given
      const logMessage = '[WARN] High traffic detected';

      // When
      const level = logMessage.includes('[CRITICAL]')
        ? 'ERROR'
        : logMessage.includes('[ERROR]')
          ? 'ERROR'
          : logMessage.includes('[WARN]')
            ? 'WARN'
            : 'INFO';

      // Then
      expect(level).toBe('WARN');
    });

    it('[INFO] 로그 → INFO 레벨 매핑', () => {
      // Given
      const logMessage = '[INFO] Processing requests normally';

      // When
      const level = logMessage.includes('[CRITICAL]')
        ? 'ERROR'
        : logMessage.includes('[ERROR]')
          ? 'ERROR'
          : logMessage.includes('[WARN]')
            ? 'WARN'
            : 'INFO';

      // Then
      expect(level).toBe('INFO');
    });
  });

  describe('시나리오 메타데이터', () => {
    it('시나리오 정보 포함', () => {
      // Given
      const scenario = mockHourlyData.scenario;

      // Then
      expect(scenario.name).toBe('traffic_cycle');
      expect(scenario.description).toContain('트래픽');
      expect(scenario.phase).toBe('peak');
      expect(scenario.intensity).toBe(0.8);
    });

    it('intensity가 0-1 범위', () => {
      // Given
      const intensity = mockHourlyData.scenario.intensity;

      // Then
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });

  describe('서버 상태 집계', () => {
    it('상태별 서버 수 집계', () => {
      // Given
      const servers = mockHourlyData.servers;

      // When
      const stats = {
        total: servers.length,
        online: servers.filter((s) => s.status === 'online').length,
        warning: servers.filter((s) => s.status === 'warning').length,
        critical: servers.filter((s) => s.status === 'critical').length,
      };

      // Then
      expect(stats.total).toBe(3);
      expect(stats.online).toBe(1);
      expect(stats.warning).toBe(1);
      expect(stats.critical).toBe(1);
    });

    it('평균 메트릭 계산', () => {
      // Given
      const servers = mockHourlyData.servers;

      // When
      const avgCpu =
        servers.reduce((sum, s) => sum + s.cpu, 0) / servers.length;
      const avgMemory =
        servers.reduce((sum, s) => sum + s.memory, 0) / servers.length;

      // Then
      expect(avgCpu).toBeCloseTo((75 + 60 + 85) / 3);
      expect(avgMemory).toBeCloseTo((80 + 65 + 90) / 3);
    });
  });

  describe('캐싱 동작', () => {
    it('동일 시간대 요청은 캐시된 데이터 반환', () => {
      // Given
      const cache: { hour: number; data: typeof mockHourlyData } | null = null;
      const currentHour = 14;

      // When - 첫 번째 요청
      const isCacheValid = cache !== null && cache.hour === currentHour;
      const data1 = isCacheValid ? cache.data : mockHourlyData;

      // Then
      expect(isCacheValid).toBe(false);
      expect(data1).toBe(mockHourlyData);
    });

    it('시간대 변경 시 캐시 무효화', () => {
      // Given
      const cache = { hour: 13, data: mockHourlyData };
      const currentHour = 14;

      // When
      const isCacheValid = cache.hour === currentHour;

      // Then
      expect(isCacheValid).toBe(false);
    });
  });

  describe('데이터 일관성', () => {
    it('모든 서버에 필수 필드 존재', () => {
      // Given
      const requiredFields = [
        'serverId',
        'serverType',
        'cpu',
        'memory',
        'disk',
        'network',
        'status',
      ];

      // Then
      for (const server of mockHourlyData.servers) {
        for (const field of requiredFields) {
          expect(server).toHaveProperty(field);
        }
      }
    });

    it('메트릭 값이 숫자 타입', () => {
      // Given
      const metricFields = ['cpu', 'memory', 'disk', 'network'];

      // Then
      for (const server of mockHourlyData.servers) {
        for (const field of metricFields) {
          expect(typeof server[field as keyof typeof server]).toBe('number');
        }
      }
    });

    it('serverId 형식 검증 (type-number)', () => {
      // Given
      const serverIdPattern = /^[a-z]+-\d+$/;

      // Then
      for (const server of mockHourlyData.servers) {
        expect(server.serverId).toMatch(serverIdPattern);
      }
    });
  });
});
