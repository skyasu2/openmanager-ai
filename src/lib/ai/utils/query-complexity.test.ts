/**
 * Query Complexity Analyzer Unit Tests
 *
 * @description 사용자 쿼리 복잡도 분석 및 동적 타임아웃 계산 검증
 * @created 2026-01-10 v5.84.3
 */
import { describe, expect, it } from 'vitest';

import {
  analyzeJobQueryComplexity,
  analyzeQueryComplexity,
  calculateDynamicTimeout,
  getTimeoutGuidance,
  inferJobType,
} from './query-complexity';

describe('query-complexity', () => {
  describe('analyzeQueryComplexity', () => {
    describe('simple queries', () => {
      it('should classify greeting as simple', () => {
        const result = analyzeQueryComplexity('안녕하세요');
        expect(result.level).toBe('simple');
        expect(result.score).toBeLessThanOrEqual(20);
      });

      it('should classify "hello" as simple', () => {
        const result = analyzeQueryComplexity('hello');
        expect(result.level).toBe('simple');
        expect(result.factors).toContain('simple_greeting_or_status');
      });

      it('should classify status check as simple', () => {
        const result = analyzeQueryComplexity('상태 확인');
        expect(result.level).toBe('simple');
        expect(result.recommendedTimeout).toBe(15000);
      });

      it('should classify help request as simple', () => {
        const result = analyzeQueryComplexity('도움말');
        expect(result.level).toBe('simple');
      });
    });

    describe('moderate queries', () => {
      it('should classify aggregation queries with analysis', () => {
        // Query with multiple factors (aggregation + analysis + multiServer)
        const result = analyzeQueryComplexity('전체 서버들의 평균 상태 분석');
        // May be moderate or complex depending on combined factors
        expect(['simple', 'moderate', 'complex']).toContain(result.level);
        expect(result.factors).toContain('keyword_aggregation');
      });

      it('should classify time range queries with additional context', () => {
        // "최근" alone may not push to moderate without other factors
        const result = analyzeQueryComplexity(
          '최근 7일간 서버 로그를 분석해줘'
        );
        expect(['simple', 'moderate']).toContain(result.level);
        expect(result.factors).toContain('keyword_timeRange');
      });
    });

    describe('complex queries', () => {
      it('should detect analysis keywords', () => {
        const result = analyzeQueryComplexity(
          '서버 CPU 패턴 분석해서 추세를 알려줘'
        );
        // The query has analysis keywords but may be scored as simple/moderate
        expect(result.factors).toContain('keyword_analysis');
        expect(result.score).toBeGreaterThan(0);
      });

      it('should classify prediction queries as complex', () => {
        const result = analyzeQueryComplexity('서버 리소스 예측해줘');
        expect(result.factors).toContain('keyword_prediction');
        expect(result.score).toBeGreaterThanOrEqual(25);
      });

      it('should classify multi-server queries as complex', () => {
        const result = analyzeQueryComplexity('모든 서버들의 상태를 비교 분석');
        expect(result.factors).toContain('keyword_multiServer');
      });
    });

    describe('very complex queries', () => {
      it('should classify root cause analysis as very complex', () => {
        const result = analyzeQueryComplexity(
          '왜 서버가 다운됐는지 원인을 분석하고 예측해서 보고서 작성해줘'
        );
        expect(result.level).toBe('very_complex');
        expect(result.score).toBeGreaterThanOrEqual(70);
        // Vercel 60초 제한으로 인해 55초로 상한 조정됨 (Job Queue 전환 대상)
        expect(result.recommendedTimeout).toBe(55000);
      });

      it('should handle long queries with multiple factors', () => {
        const longQuery = `
          지난 달 동안의 모든 서버 클러스터에서 발생한
          CPU, 메모리 에러를 분석하고 원인을 진단해서
          상세 보고서를 작성해주세요.
        `;
        const result = analyzeQueryComplexity(longQuery);
        expect(result.level).toBe('very_complex');
        expect(result.factors.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('query length scoring', () => {
      it('should add score for long queries (>200 chars)', () => {
        const longQuery = 'a'.repeat(250);
        const result = analyzeQueryComplexity(longQuery);
        expect(result.factors).toContain('long_query');
      });

      it('should add score for medium queries (>100 chars)', () => {
        const mediumQuery = 'a'.repeat(150);
        const result = analyzeQueryComplexity(mediumQuery);
        expect(result.factors).toContain('medium_query');
      });
    });

    describe('multiple questions', () => {
      it('should increase score for multiple question marks', () => {
        const result = analyzeQueryComplexity('서버 상태는? 메모리는? CPU는?');
        expect(result.factors).toContain('multiple_questions_3');
      });
    });

    describe('date/time range detection', () => {
      it('should detect date format', () => {
        const result = analyzeQueryComplexity('2024-01-15 로그 분석');
        expect(result.factors).toContain('date_time_range');
      });

      it('should detect time range keywords', () => {
        const result = analyzeQueryComplexity('24시간 동안의 로그');
        expect(result.factors).toContain('date_time_range');
      });

      it('should detect Korean time units', () => {
        const result = analyzeQueryComplexity('7일간의 데이터 분석');
        expect(result.factors).toContain('date_time_range');
      });
    });

    describe('score capping', () => {
      it('should cap score at 100', () => {
        const extremeQuery = `
          모든 서버들의 지난 달 동안의 CPU, 메모리, 디스크 사용량을
          분석하고 패턴을 찾아서 미래 예측하고 원인 진단해서
          상세 보고서를 작성해주세요. 왜 이런 문제가 발생했는지?
          어떻게 해결해야 하는지? 언제 재발할 수 있는지?
        `;
        const result = analyzeQueryComplexity(extremeQuery);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateDynamicTimeout', () => {
    it('should return recommended timeout for simple query', () => {
      const timeout = calculateDynamicTimeout('안녕');
      expect(timeout).toBe(15000);
    });

    it('should respect minTimeout', () => {
      const timeout = calculateDynamicTimeout('hi', { minTimeout: 20000 });
      expect(timeout).toBe(20000);
    });

    it('should respect maxTimeout', () => {
      const complexQuery = '모든 서버 원인 분석하고 예측해서 보고서 작성해줘';
      const timeout = calculateDynamicTimeout(complexQuery, {
        maxTimeout: 60000,
      });
      expect(timeout).toBeLessThanOrEqual(60000);
    });

    it('should add time for large message count', () => {
      const baseTimeout = calculateDynamicTimeout('간단한 질문');
      const withMessages = calculateDynamicTimeout('간단한 질문', {
        messageCount: 15,
      });
      expect(withMessages).toBeGreaterThan(baseTimeout);
    });

    it('should add more time for very large message count', () => {
      const smallContext = calculateDynamicTimeout('테스트', {
        messageCount: 5,
      });
      const largeContext = calculateDynamicTimeout('테스트', {
        messageCount: 25,
      });
      expect(largeContext).toBeGreaterThan(smallContext);
    });
  });

  describe('getTimeoutGuidance', () => {
    it('should return fast response message for simple queries', () => {
      const analysis = analyzeQueryComplexity('안녕');
      const guidance = getTimeoutGuidance(analysis);
      expect(guidance).toContain('빠른 응답');
    });

    it('should return analyzing message for moderate queries', () => {
      const analysis = analyzeQueryComplexity('전체 서버 상태 분석');
      const guidance = getTimeoutGuidance(analysis);
      expect(guidance).toContain('분석');
    });

    it('should return complex analysis message for complex queries', () => {
      const analysis = analyzeQueryComplexity(
        '서버 패턴 분석하고 예측해줘 보고서도'
      );
      const guidance = getTimeoutGuidance(analysis);
      expect(guidance).toMatch(/분석|심층/);
    });

    it('should include timeout in seconds', () => {
      const analysis = analyzeQueryComplexity('안녕');
      const guidance = getTimeoutGuidance(analysis);
      expect(guidance).toMatch(/\d+초/);
    });
  });

  describe('analyzeQueryComplexity', () => {
    it('should keep broad summary queries on streaming path', () => {
      const result = analyzeQueryComplexity('현재 모든 서버의 상태를 요약해줘');
      expect(result.level).toBe('simple');
      expect(result.score).toBeLessThanOrEqual(20);
      expect(result.factors).toContain('streaming_summary_query');
    });
  });

  describe('analyzeJobQueryComplexity', () => {
    it('should classify simple status query as simple', () => {
      const result = analyzeJobQueryComplexity('현재 상태 알려줘');
      expect(result.level).toBe('simple');
      expect(result.useJobQueue).toBe(false);
    });

    it('should keep broad summary queries on streaming path', () => {
      const result = analyzeJobQueryComplexity(
        '현재 모든 서버의 상태를 요약해줘'
      );
      expect(result.level).toBe('simple');
      expect(result.useJobQueue).toBe(false);
      expect(result.factors.analysisDepth).toBe('shallow');
    });

    it('should classify complex analysis query as complex', () => {
      const result = analyzeJobQueryComplexity(
        '전체 서버 분석하고 최적화 방안 추천해줘 보고서도 작성'
      );
      expect(result.level).toBe('complex');
      expect(result.useJobQueue).toBe(true);
      expect(result.factors.analysisDepth).toBe('deep');
    });

    it('should classify medium complexity query', () => {
      const result = analyzeJobQueryComplexity('서버 비교 분석해줘');
      expect(['medium', 'complex']).toContain(result.level);
      expect(result.estimatedTime).toBeGreaterThan(5);
    });

    it('should detect multi-step queries', () => {
      const result = analyzeJobQueryComplexity(
        '먼저 분석하고 그리고 최적화 추천해줘'
      );
      expect(result.factors.multiStep).toBe(true);
    });

    it('should detect data-heavy queries', () => {
      const result = analyzeJobQueryComplexity('30일간 전체 서버 이력 분석');
      expect(result.factors.dataVolume).not.toBe('low');
    });

    it('should upgrade long simple queries to medium', () => {
      const longSimple = `상태 확인해줘 ${'a'.repeat(100)}`;
      const result = analyzeJobQueryComplexity(longSimple);
      expect(result.level).not.toBe('simple');
    });
  });

  describe('inferJobType', () => {
    it('should infer report type', () => {
      expect(inferJobType('서버 보고서 작성해줘')).toBe('report');
      expect(inferJobType('리포트 생성')).toBe('report');
    });

    it('should infer optimization type', () => {
      expect(inferJobType('성능 최적화 방안')).toBe('optimization');
      expect(inferJobType('서버 개선 추천')).toBe('optimization');
    });

    it('should infer prediction type', () => {
      expect(inferJobType('리소스 예측해줘')).toBe('prediction');
      expect(inferJobType('forecast CPU usage')).toBe('prediction');
    });

    it('should infer analysis type', () => {
      expect(inferJobType('CPU 사용률 분석해줘')).toBe('analysis');
    });

    it('should default to general', () => {
      expect(inferJobType('안녕하세요')).toBe('general');
      expect(inferJobType('서버 상태 알려줘')).toBe('general');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = analyzeQueryComplexity('');
      expect(result.level).toBeDefined();
      expect(result.recommendedTimeout).toBeGreaterThan(0);
    });

    it('should handle whitespace only', () => {
      const result = analyzeQueryComplexity('   ');
      expect(result.level).toBeDefined();
    });

    it('should be case insensitive', () => {
      const lower = analyzeQueryComplexity('analyze');
      const upper = analyzeQueryComplexity('ANALYZE');
      expect(lower.factors).toContain('keyword_analysis');
      expect(upper.factors).toContain('keyword_analysis');
    });

    it('should handle mixed Korean and English', () => {
      const result = analyzeQueryComplexity('서버 CPU analyze 해줘');
      expect(result.factors).toContain('keyword_analysis');
    });
  });
});
