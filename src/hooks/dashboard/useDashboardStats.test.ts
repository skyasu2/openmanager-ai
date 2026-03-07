/**
 * useDashboardStats Unit Tests
 *
 * 서버 상태별 통계 계산 로직 검증.
 * renderHook으로 React 훅 테스트.
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/debug', () => ({
  default: { log: vi.fn() },
}));

import { useDashboardStats } from './useDashboardStats';
import type { Server } from '@/types/server';

function makeServer(id: string, status: string): Server {
  return { id, name: `Server ${id}`, status } as Server;
}

describe('useDashboardStats', () => {
  describe('empty / loading states', () => {
    it('should return all zeros when loading', () => {
      const { result } = renderHook(() =>
        useDashboardStats([makeServer('1', 'online')], undefined, true)
      );
      expect(result.current).toEqual({
        total: 0, online: 0, offline: 0, warning: 0, critical: 0, unknown: 0,
      });
    });

    it('should return all zeros for empty servers', () => {
      const { result } = renderHook(() => useDashboardStats([]));
      expect(result.current.total).toBe(0);
    });
  });

  describe('status counting', () => {
    it('should count online/running/active as online', () => {
      const servers = [
        makeServer('1', 'online'),
        makeServer('2', 'running'),
        makeServer('3', 'active'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.online).toBe(3);
      expect(result.current.total).toBe(3);
    });

    it('should count offline/down/disconnected as offline', () => {
      const servers = [
        makeServer('1', 'offline'),
        makeServer('2', 'down'),
        makeServer('3', 'disconnected'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.offline).toBe(3);
    });

    it('should count critical/error/failed as critical', () => {
      const servers = [
        makeServer('1', 'critical'),
        makeServer('2', 'error'),
        makeServer('3', 'failed'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.critical).toBe(3);
    });

    it('should count warning/degraded/unstable as warning', () => {
      const servers = [
        makeServer('1', 'warning'),
        makeServer('2', 'degraded'),
        makeServer('3', 'unstable'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.warning).toBe(3);
    });

    it('should count unknown/maintenance and undefined as unknown', () => {
      const servers = [
        makeServer('1', 'unknown'),
        makeServer('2', 'maintenance'),
        makeServer('3', 'some-random-status'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.unknown).toBe(3);
    });

    it('should handle case-insensitive status', () => {
      const servers = [
        makeServer('1', 'ONLINE'),
        makeServer('2', 'Warning'),
        makeServer('3', 'CRITICAL'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current.online).toBe(1);
      expect(result.current.warning).toBe(1);
      expect(result.current.critical).toBe(1);
    });

    it('should handle missing status as unknown', () => {
      const server = { id: '1', name: 'No Status' } as Server;
      const { result } = renderHook(() => useDashboardStats([server]));
      expect(result.current.unknown).toBe(1);
    });
  });

  describe('allServers priority', () => {
    it('should prefer allServers over servers when both provided', () => {
      const servers = [makeServer('1', 'online')];
      const allServers = [
        makeServer('1', 'online'),
        makeServer('2', 'warning'),
        makeServer('3', 'critical'),
      ];
      const { result } = renderHook(() =>
        useDashboardStats(servers, allServers)
      );
      expect(result.current.total).toBe(3);
    });

    it('should fallback to servers when allServers is empty', () => {
      const servers = [makeServer('1', 'online'), makeServer('2', 'warning')];
      const { result } = renderHook(() =>
        useDashboardStats(servers, [])
      );
      expect(result.current.total).toBe(2);
    });
  });

  describe('mixed statuses', () => {
    it('should correctly count a mixed set of servers', () => {
      const servers = [
        makeServer('1', 'online'),
        makeServer('2', 'online'),
        makeServer('3', 'warning'),
        makeServer('4', 'critical'),
        makeServer('5', 'offline'),
        makeServer('6', 'unknown'),
      ];
      const { result } = renderHook(() => useDashboardStats(servers));
      expect(result.current).toEqual({
        total: 6,
        online: 2,
        warning: 1,
        critical: 1,
        offline: 1,
        unknown: 1,
      });
    });
  });
});
