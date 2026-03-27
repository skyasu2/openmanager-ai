/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('분당 제한', () => {
    beforeEach(() => {
      limiter = new InMemoryRateLimiter({
        maxRequests: 3,
        windowMs: 60_000,
        maxEntries: 100,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 100,
      });
    });

    it('제한 내 요청은 허용하고 남은 횟수를 반환한다', () => {
      // Given: 새 IP에서 첫 요청

      // When: 요청 체크
      const result = limiter.checkLimit('192.168.1.1:/api/test');

      // Then: 허용되고 남은 횟수 = maxRequests - 1
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('제한 초과 시 요청을 거부한다', () => {
      // Given: 3회 요청으로 제한 소진
      limiter.checkLimit('192.168.1.1:/api/test');
      limiter.checkLimit('192.168.1.1:/api/test');
      limiter.checkLimit('192.168.1.1:/api/test');

      // When: 4번째 요청
      const result = limiter.checkLimit('192.168.1.1:/api/test');

      // Then: 거부
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toBe('rate_limit_exceeded');
    });

    it('윈도우 리셋 후 다시 허용한다', () => {
      // Given: 제한 소진
      limiter.checkLimit('192.168.1.1:/api/test');
      limiter.checkLimit('192.168.1.1:/api/test');
      limiter.checkLimit('192.168.1.1:/api/test');
      expect(limiter.checkLimit('192.168.1.1:/api/test').allowed).toBe(false);

      // When: 1분 경과 후 요청
      vi.advanceTimersByTime(60_001);
      const result = limiter.checkLimit('192.168.1.1:/api/test');

      // Then: 다시 허용
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('서로 다른 IP는 독립적으로 제한한다', () => {
      // Given: IP-A가 제한 소진
      limiter.checkLimit('10.0.0.1:/api/test');
      limiter.checkLimit('10.0.0.1:/api/test');
      limiter.checkLimit('10.0.0.1:/api/test');

      // When: IP-B에서 요청
      const result = limiter.checkLimit('10.0.0.2:/api/test');

      // Then: IP-B는 허용
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('일일 제한', () => {
    beforeEach(() => {
      limiter = new InMemoryRateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        dailyLimit: 5,
        maxEntries: 100,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 1000,
      });
    });

    it('일일 제한 내 요청은 남은 일일 횟수를 반환한다', () => {
      // Given: 첫 요청

      // When: 요청 체크
      const result = limiter.checkLimit('192.168.1.1:/api/ai');

      // Then: 일일 남은 횟수 포함
      expect(result.allowed).toBe(true);
      expect(result.daily).toBeDefined();
      expect(result.daily?.remaining).toBe(4);
    });

    it('일일 제한 초과 시 요청을 거부한다', () => {
      // Given: 5회 요청으로 일일 제한 소진 (분당 제한은 100이라 통과)
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('192.168.1.1:/api/ai');
      }

      // When: 6번째 요청
      const result = limiter.checkLimit('192.168.1.1:/api/ai');

      // Then: 일일 제한 초과로 거부
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit_exceeded');
      expect(result.daily?.remaining).toBe(0);
    });
  });

  describe('글로벌 임계값 (DDoS 방어)', () => {
    it('글로벌 임계값 초과 시 모든 요청을 거부한다', () => {
      // Given: 임계값이 5인 리미터
      limiter = new InMemoryRateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        maxEntries: 100,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 5,
      });

      // 5개 서로 다른 IP에서 요청 → 글로벌 카운터 5 도달
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(`10.0.0.${i}:/api/test`);
      }

      // When: 새로운 IP에서 요청
      const result = limiter.checkLimit('10.0.0.99:/api/test');

      // Then: 글로벌 임계값 초과로 거부
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('global_threshold_exceeded');
    });
  });

  describe('LRU 메모리 관리', () => {
    it('maxEntries 초과 시 가장 오래된 엔트리를 제거한다', () => {
      // Given: maxEntries=5인 리미터
      limiter = new InMemoryRateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        maxEntries: 5,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 1000,
      });

      // 5개 IP로 가득 채움
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(`10.0.0.${i}:/api/test`);
      }

      // When: 6번째 IP 추가 (LRU 정리 트리거)
      limiter.checkLimit('10.0.0.99:/api/test');

      // Then: 엔트리 수가 maxEntries 이하로 유지
      const stats = limiter.getStats();
      expect(stats.entriesCount).toBeLessThanOrEqual(5);
    });
  });

  describe('상태 관리', () => {
    it('getStats()는 현재 상태를 반환한다', () => {
      // Given: 설정된 리미터
      limiter = new InMemoryRateLimiter({
        maxRequests: 10,
        windowMs: 60_000,
        maxEntries: 100,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 50,
      });

      // When: 2개 IP에서 요청
      limiter.checkLimit('10.0.0.1:/api/test');
      limiter.checkLimit('10.0.0.2:/api/test');

      // Then: 통계 반환
      const stats = limiter.getStats();
      expect(stats.entriesCount).toBe(2);
      expect(stats.globalRequestsInWindow).toBe(2);
      expect(stats.maxEntries).toBe(100);
      expect(stats.failClosedThreshold).toBe(50);
    });

    it('reset()은 모든 상태를 초기화한다', () => {
      // Given: 요청이 누적된 리미터
      limiter = new InMemoryRateLimiter({
        maxRequests: 10,
        windowMs: 60_000,
        maxEntries: 100,
        cleanupIntervalMs: 60_000,
        failClosedThreshold: 50,
      });
      limiter.checkLimit('10.0.0.1:/api/test');
      limiter.checkLimit('10.0.0.2:/api/test');

      // When: 리셋
      limiter.reset();

      // Then: 모든 상태 초기화
      const stats = limiter.getStats();
      expect(stats.entriesCount).toBe(0);
      expect(stats.globalRequestsInWindow).toBe(0);
    });
  });
});
