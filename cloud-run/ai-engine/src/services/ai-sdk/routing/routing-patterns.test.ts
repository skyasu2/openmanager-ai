import { describe, expect, it } from 'vitest';
import { INVERSE_STATUS_PATTERN, MIN_METRIC_PATTERN } from './routing-patterns';

describe('routing-patterns', () => {
  describe('INVERSE_STATUS_PATTERN', () => {
    it.each([
      '정상 범위인 서버 목록',
      '이상 없는 서버',
      '문제 없는 서버',
      '여유 있는 서버',
      'healthy server',
      'normal range server',
    ])('matches "%s"', (query) => {
      expect(INVERSE_STATUS_PATTERN.test(query)).toBe(true);
    });

    it.each([
      '어떤 서버가 가장 위험한가요?',
      'CPU 높은 서버',
      '서버 상태 요약',
    ])('does not match "%s"', (query) => {
      expect(INVERSE_STATUS_PATTERN.test(query)).toBe(false);
    });
  });

  describe('MIN_METRIC_PATTERN', () => {
    it.each([
      '부하 가장 낮은 서버',
      '최저 cpu 서버',
      '가장 여유 있는 서버',
      'lowest load server',
      'least loaded',
    ])('matches "%s"', (query) => {
      expect(MIN_METRIC_PATTERN.test(query)).toBe(true);
    });

    it.each([
      'CPU 가장 높은 서버',
      '어떤 서버가 가장 위험한가요?',
    ])('does not match "%s"', (query) => {
      expect(MIN_METRIC_PATTERN.test(query)).toBe(false);
    });
  });
});
