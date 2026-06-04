/**
 * 🧪 Vercel Optimization 유틸리티 단위 테스트
 *
 * Vercel 무료 티어 안전:
 * - 순수 함수 테스트 (외부 API 호출 없음)
 * - Mock된 환경변수 사용
 * - 동기 연산만 수행
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  },
}));

import {
  preloadCriticalResources,
  VercelPerformanceTracker,
} from './vercel-optimization';

// Store original env
const originalEnv = { ...process.env };

describe('Vercel Optimization Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  // ============================================================================
  // VercelPerformanceTracker 테스트
  // ============================================================================
  describe('VercelPerformanceTracker', () => {
    it('should track performance metrics', () => {
      delete process.env.VERCEL; // Local environment

      const tracker = new VercelPerformanceTracker();

      tracker.start('test-operation');
      // Simulate some work
      const duration = tracker.end('test-operation');

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for unknown labels', () => {
      const tracker = new VercelPerformanceTracker();

      const duration = tracker.end('unknown-label');

      expect(duration).toBe(0);
    });

    it('should store metrics and return them', () => {
      const tracker = new VercelPerformanceTracker();

      tracker.start('op1');
      tracker.end('op1');
      tracker.start('op2');
      tracker.end('op2');

      const metrics = tracker.getMetrics();

      expect(typeof metrics.op1).toBe('number');
      expect(typeof metrics.op2).toBe('number');
    });

    it('should clear metrics', () => {
      const tracker = new VercelPerformanceTracker();

      tracker.start('test');
      tracker.end('test');
      tracker.clear();

      const metrics = tracker.getMetrics();

      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe('preloadCriticalResources', () => {
    it('uses a public health endpoint instead of auth-protected /api/system', async () => {
      process.env.VERCEL = '1';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));

      await preloadCriticalResources();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/health?service=ai&soft=true',
        { method: 'HEAD' }
      );
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('/api/system')
        )
      ).toBe(false);

      fetchMock.mockRestore();
    });
  });
});
