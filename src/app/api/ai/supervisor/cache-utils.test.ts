/**
 * Cache Utils Unit Tests
 *
 * @description 캐시 스킵 로직 및 쿼리 타입 분류 검증
 * @created 2026-01-10 v5.84.3
 */
import { describe, expect, it } from 'vitest';

import {
  isStatusQuery,
  REALTIME_KEYWORDS,
  shouldSkipCache,
} from './cache-utils';

describe('cache-utils', () => {
  describe('shouldSkipCache', () => {
    describe('message count condition', () => {
      it('should skip cache when messageCount > 1', () => {
        expect(shouldSkipCache('simple query', 2)).toBe(true);
        expect(shouldSkipCache('simple query', 5)).toBe(true);
      });

      it('should not skip cache when messageCount is 1', () => {
        expect(shouldSkipCache('simple query', 1)).toBe(false);
      });

      it('should not skip cache when messageCount is 0', () => {
        expect(shouldSkipCache('simple query', 0)).toBe(false);
      });
    });

    describe('realtime keywords', () => {
      it('should skip cache for Korean realtime keywords', () => {
        expect(shouldSkipCache('지금 서버 상태', 1)).toBe(true);
        expect(shouldSkipCache('현재 CPU 사용량', 1)).toBe(true);
        expect(shouldSkipCache('방금 발생한 에러', 1)).toBe(true);
        expect(shouldSkipCache('실시간 모니터링', 1)).toBe(true);
        expect(shouldSkipCache('새로고침 해줘', 1)).toBe(true);
      });

      it('should skip cache for English realtime keywords', () => {
        expect(shouldSkipCache('show me now', 1)).toBe(true);
        expect(shouldSkipCache('current status', 1)).toBe(true);
        expect(shouldSkipCache('latest metrics', 1)).toBe(true);
        expect(shouldSkipCache('live data please', 1)).toBe(true);
        expect(shouldSkipCache('refresh the page', 1)).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(shouldSkipCache('NOW', 1)).toBe(true);
        expect(shouldSkipCache('CURRENT status', 1)).toBe(true);
        expect(shouldSkipCache('Latest', 1)).toBe(true);
      });

      it('should not skip cache for non-realtime queries', () => {
        expect(shouldSkipCache('서버 구성 알려줘', 1)).toBe(false);
        expect(shouldSkipCache('CPU란 무엇인가요?', 1)).toBe(false);
        expect(shouldSkipCache('show me the logs', 1)).toBe(false);
      });
    });

    describe('combined conditions', () => {
      it('should skip if messageCount > 1 even without realtime keywords', () => {
        expect(shouldSkipCache('일반 질문', 3)).toBe(true);
      });

      it('should skip if realtime keyword present even with messageCount 1', () => {
        expect(shouldSkipCache('지금 상태', 1)).toBe(true);
      });
    });
  });

  describe('isStatusQuery', () => {
    it('should detect Korean status keywords', () => {
      expect(isStatusQuery('서버 상태 알려줘')).toBe(true);
      expect(isStatusQuery('시스템 상태 확인')).toBe(true);
      expect(isStatusQuery('상태가 어떻게 되나요?')).toBe(true);
    });

    it('should detect English status keywords', () => {
      expect(isStatusQuery('check status')).toBe(true);
      expect(isStatusQuery('health check')).toBe(true);
      expect(isStatusQuery('system health')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isStatusQuery('STATUS')).toBe(true);
      expect(isStatusQuery('Health')).toBe(true);
    });

    it('should return false for non-status queries', () => {
      expect(isStatusQuery('CPU 사용량')).toBe(false);
      expect(isStatusQuery('로그 보여줘')).toBe(false);
      expect(isStatusQuery('what is this')).toBe(false);
    });
  });

  describe('REALTIME_KEYWORDS constant', () => {
    it('should contain expected Korean keywords', () => {
      expect(REALTIME_KEYWORDS).toContain('지금');
      expect(REALTIME_KEYWORDS).toContain('현재');
      expect(REALTIME_KEYWORDS).toContain('실시간');
      expect(REALTIME_KEYWORDS).toContain('새로고침');
    });

    it('should contain expected English keywords', () => {
      expect(REALTIME_KEYWORDS).toContain('now');
      expect(REALTIME_KEYWORDS).toContain('current');
      expect(REALTIME_KEYWORDS).toContain('latest');
      expect(REALTIME_KEYWORDS).toContain('live');
      expect(REALTIME_KEYWORDS).toContain('refresh');
    });

    it('should be a non-empty array', () => {
      expect(Array.isArray(REALTIME_KEYWORDS)).toBe(true);
      expect(REALTIME_KEYWORDS.length).toBeGreaterThan(0);
    });
  });
});
