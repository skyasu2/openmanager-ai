/**
 * 🧪 Vercel Optimization 유틸리티 단위 테스트
 *
 * Vercel 무료 티어 안전:
 * - 순수 함수 테스트 (외부 API 호출 없음)
 * - Mock된 환경변수 사용
 * - 동기 연산만 수행
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

describe('Vercel Optimization Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
    it('should track performance metrics', async () => {
      delete process.env.VERCEL; // Local environment

      const { VercelPerformanceTracker } = await import(
        './vercel-optimization'
      );
      const tracker = new VercelPerformanceTracker();

      tracker.start('test-operation');
      // Simulate some work
      const duration = tracker.end('test-operation');

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for unknown labels', async () => {
      const { VercelPerformanceTracker } = await import(
        './vercel-optimization'
      );
      const tracker = new VercelPerformanceTracker();

      const duration = tracker.end('unknown-label');

      expect(duration).toBe(0);
    });

    it('should store metrics and return them', async () => {
      const { VercelPerformanceTracker } = await import(
        './vercel-optimization'
      );
      const tracker = new VercelPerformanceTracker();

      tracker.start('op1');
      tracker.end('op1');
      tracker.start('op2');
      tracker.end('op2');

      const metrics = tracker.getMetrics();

      expect(typeof metrics.op1).toBe('number');
      expect(typeof metrics.op2).toBe('number');
    });

    it('should clear metrics', async () => {
      const { VercelPerformanceTracker } = await import(
        './vercel-optimization'
      );
      const tracker = new VercelPerformanceTracker();

      tracker.start('test');
      tracker.end('test');
      tracker.clear();

      const metrics = tracker.getMetrics();

      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });
});
