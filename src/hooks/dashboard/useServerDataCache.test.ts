/**
 * useServerDataCache Unit Tests
 *
 * 캐싱 정책 검증: 유효 데이터 업데이트, 에러 시 이전 캐시 유지.
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import { useServerDataCache } from './useServerDataCache';

function makeServerData(id: string): EnhancedServerData {
  return { id, name: `Server ${id}`, status: 'online' } as EnhancedServerData;
}

describe('useServerDataCache', () => {
  describe('valid data', () => {
    it('should return raw servers when data is valid', () => {
      const servers = [makeServerData('1'), makeServerData('2')];
      const { result } = renderHook(() => useServerDataCache(servers));
      expect(result.current.cachedServers).toEqual(servers);
    });

    it('should update cache when new data arrives', () => {
      const initial = [makeServerData('1')];
      const updated = [makeServerData('1'), makeServerData('2')];

      const { result, rerender } = renderHook(
        ({ data }) => useServerDataCache(data),
        { initialProps: { data: initial } }
      );
      expect(result.current.cachedServers).toHaveLength(1);

      rerender({ data: updated });
      expect(result.current.cachedServers).toHaveLength(2);
    });
  });

  describe('empty array handling', () => {
    it('should return empty array for empty input (default)', () => {
      const { result } = renderHook(() => useServerDataCache([]));
      expect(result.current.cachedServers).toEqual([]);
    });

    it('should keep previous data on empty array when keepPreviousOnError is true', () => {
      const initial = [makeServerData('1')];

      const { result, rerender } = renderHook(
        ({ data, opts }) => useServerDataCache(data, opts),
        { initialProps: { data: initial, opts: { keepPreviousOnError: true } } }
      );
      expect(result.current.cachedServers).toHaveLength(1);

      rerender({
        data: [] as EnhancedServerData[],
        opts: { keepPreviousOnError: true },
      });
      expect(result.current.cachedServers).toHaveLength(1);
    });

    it('should clear cache on empty array when keepPreviousOnError is false', () => {
      const initial = [makeServerData('1')];

      const { result, rerender } = renderHook(
        ({ data, opts }) => useServerDataCache(data, opts),
        {
          initialProps: { data: initial, opts: { keepPreviousOnError: false } },
        }
      );
      expect(result.current.cachedServers).toHaveLength(1);

      rerender({
        data: [] as EnhancedServerData[],
        opts: { keepPreviousOnError: false },
      });
      expect(result.current.cachedServers).toEqual([]);
    });
  });

  describe('invalid data handling', () => {
    it('should return previous cache for null/undefined input', () => {
      const initial = [makeServerData('1')];

      const { result, rerender } = renderHook(
        ({ data }) => useServerDataCache(data),
        { initialProps: { data: initial as EnhancedServerData[] } }
      );
      expect(result.current.cachedServers).toHaveLength(1);

      // null input should keep previous cache
      rerender({ data: null as unknown as EnhancedServerData[] });
      expect(result.current.cachedServers).toHaveLength(1);
    });

    it('should return empty array for invalid input when no previous cache', () => {
      const { result } = renderHook(() =>
        useServerDataCache(null as unknown as EnhancedServerData[])
      );
      expect(result.current.cachedServers).toEqual([]);
    });
  });
});
