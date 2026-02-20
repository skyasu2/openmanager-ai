/**
 * 🧪 Dashboard Server Utils 단위 테스트
 *
 * Vercel 무료 티어 안전:
 * - 순수 함수 테스트 (외부 API 호출 없음)
 * - Mock된 Web Worker 통계 사용
 * - 동기 연산만 수행
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';

// Mock useWorkerStats hook
vi.mock('@/hooks/useWorkerStats', () => ({
  calculateServerStatsFallback: vi.fn((servers) => ({
    total: servers.length,
    online: servers.filter(
      (s: EnhancedServerData) => s.status === 'normal' || s.status === 'online'
    ).length,
    offline: servers.filter((s: EnhancedServerData) => s.status === 'offline')
      .length,
    unknown: servers.filter((s: EnhancedServerData) => s.status === 'unknown')
      .length,
    warning: servers.filter((s: EnhancedServerData) => s.status === 'warning')
      .length,
    critical: servers.filter((s: EnhancedServerData) => s.status === 'critical')
      .length,
    averageCpu:
      servers.length > 0
        ? servers.reduce(
            (sum: number, s: EnhancedServerData) => sum + (s.cpu || 0),
            0
          ) / servers.length
        : 0,
    averageMemory:
      servers.length > 0
        ? servers.reduce(
            (sum: number, s: EnhancedServerData) => sum + (s.memory || 0),
            0
          ) / servers.length
        : 0,
  })),
}));

import {
  _groupServersByStatus,
  _hasValidLength,
  getServerGroupKey,
  isValidArray,
  isValidNumber,
  isValidServer,
} from './server-utils';

describe('Dashboard Server Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Type Guard 함수 테스트
  // ============================================================================
  describe('isValidArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isValidArray([1, 2, 3])).toBe(true);
      expect(isValidArray(['a', 'b'])).toBe(true);
      expect(isValidArray([{ id: '1' }])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      expect(isValidArray([])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isValidArray(null)).toBe(false);
      expect(isValidArray(undefined)).toBe(false);
      expect(isValidArray('string')).toBe(false);
      expect(isValidArray(123)).toBe(false);
      expect(isValidArray({})).toBe(false);
    });
  });

  describe('isValidServer', () => {
    it('should return true for valid server objects', () => {
      const server: EnhancedServerData = {
        id: 'server-1',
        name: 'Test Server',
        status: 'normal',
        cpu: 50,
        memory: 60,
        disk: 70,
        uptime: 86400,
        type: 'web',
        roles: ['web'],
        ip: '192.168.1.1',
        lastUpdated: Date.now(),
        metrics: {},
      };
      expect(isValidServer(server)).toBe(true);
    });

    it('should return true for minimal server with string id', () => {
      expect(isValidServer({ id: 'server-id' })).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isValidServer(null)).toBe(false);
      expect(isValidServer(undefined)).toBe(false);
    });

    it('should return false for objects without id', () => {
      expect(isValidServer({})).toBe(false);
      expect(isValidServer({ name: 'server' })).toBe(false);
    });

    it('should return false for objects with non-string id', () => {
      expect(isValidServer({ id: 123 })).toBe(false);
      expect(isValidServer({ id: null })).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid positive numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(100)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isValidNumber(-1)).toBe(false);
      expect(isValidNumber(-100)).toBe(false);
    });

    it('should return false for NaN and Infinity', () => {
      expect(isValidNumber(Number.NaN)).toBe(false);
      expect(isValidNumber(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isValidNumber(Number.NEGATIVE_INFINITY)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber('100')).toBe(false);
      expect(isValidNumber({})).toBe(false);
    });
  });

  describe('_hasValidLength', () => {
    it('should return true for arrays', () => {
      expect(_hasValidLength([1, 2, 3])).toBe(true);
      expect(_hasValidLength([])).toBe(true);
    });

    // Note: _hasValidLength checks typeof === 'object', so primitives (strings) return false
    it('should return false for strings (primitive type)', () => {
      // 함수 구현이 typeof value === 'object'를 체크하므로
      // 문자열(primitive)은 false 반환
      expect(_hasValidLength('hello')).toBe(false);
      expect(_hasValidLength('')).toBe(false);
    });

    it('should return true for objects with length property', () => {
      expect(_hasValidLength({ length: 5 })).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(_hasValidLength(null)).toBe(false);
      expect(_hasValidLength(undefined)).toBe(false);
    });

    it('should return false for objects without length', () => {
      expect(_hasValidLength({})).toBe(false);
      expect(_hasValidLength({ size: 5 })).toBe(false);
    });

    it('should return false for negative length', () => {
      // isValidNumber requires value >= 0
      expect(_hasValidLength({ length: -1 })).toBe(false);
    });
  });

  // ============================================================================
  // getServerGroupKey 테스트
  // ============================================================================
  describe('getServerGroupKey', () => {
    it('should generate consistent key for same servers', () => {
      const servers: EnhancedServerData[] = [
        {
          id: 's1',
          name: 'Server 1',
          status: 'normal',
          cpu: 50,
          memory: 60,
          disk: 70,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
        {
          id: 's2',
          name: 'Server 2',
          status: 'warning',
          cpu: 80,
          memory: 90,
          disk: 85,
          uptime: 0,
          type: 'db',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ];

      const key1 = getServerGroupKey(servers);
      const key2 = getServerGroupKey(servers);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different servers', () => {
      const servers1: EnhancedServerData[] = [
        {
          id: 's1',
          name: 'Server 1',
          status: 'normal',
          cpu: 50,
          memory: 60,
          disk: 70,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ];
      const servers2: EnhancedServerData[] = [
        {
          id: 's1',
          name: 'Server 1',
          status: 'warning',
          cpu: 80,
          memory: 60,
          disk: 70,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ];

      const key1 = getServerGroupKey(servers1);
      const key2 = getServerGroupKey(servers2);

      expect(key1).not.toBe(key2);
    });

    it('should include all relevant fields in key', () => {
      const servers: EnhancedServerData[] = [
        {
          id: 'test-id',
          name: 'Test',
          status: 'normal',
          cpu: 45,
          memory: 55,
          disk: 65,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ];

      const key = getServerGroupKey(servers);

      expect(key).toContain('test-id');
      expect(key).toContain('normal');
      expect(key).toContain('45');
      expect(key).toContain('55');
      expect(key).toContain('65');
    });
  });

  // ============================================================================
  // _groupServersByStatus 테스트
  // ============================================================================
  describe('_groupServersByStatus', () => {
    it('should group servers by status', () => {
      const servers: EnhancedServerData[] = [
        {
          id: 's1',
          name: 'S1',
          status: 'normal',
          cpu: 50,
          memory: 50,
          disk: 50,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
        {
          id: 's2',
          name: 'S2',
          status: 'normal',
          cpu: 50,
          memory: 50,
          disk: 50,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
        {
          id: 's3',
          name: 'S3',
          status: 'warning',
          cpu: 80,
          memory: 50,
          disk: 50,
          uptime: 0,
          type: 'db',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ];

      const groups = _groupServersByStatus(servers);

      expect(groups.get('normal')?.length).toBe(2);
      expect(groups.get('warning')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = _groupServersByStatus([]);
      expect(groups.size).toBe(0);
    });

    it('should use "unknown" for missing status', () => {
      const servers = [
        {
          id: 's1',
          name: 'S1',
          status: undefined,
          cpu: 50,
          memory: 50,
          disk: 50,
          uptime: 0,
          type: 'web',
          roles: [],
          ip: '',
          lastUpdated: 0,
          metrics: {},
        },
      ] as unknown as EnhancedServerData[];

      const groups = _groupServersByStatus(servers);

      expect(groups.get('unknown')?.length).toBe(1);
    });
  });

  // ============================================================================
  // adaptWorkerStatsToLegacy 테스트
  // ============================================================================
});
