import { describe, expect, it } from 'vitest';
import {
  classifyQuery,
  needsClarification,
  QueryClassifier,
} from './query-classifier';

describe('needsClarification', () => {
  it('returns true when confidence < 85 and complexity >= 2', () => {
    expect(needsClarification(84, 2)).toBe(true);
    expect(needsClarification(50, 3)).toBe(true);
  });

  it('returns false when confidence >= 85', () => {
    expect(needsClarification(85, 2)).toBe(false);
    expect(needsClarification(100, 5)).toBe(false);
  });

  it('returns false when complexity < 2', () => {
    expect(needsClarification(50, 1)).toBe(false);
    expect(needsClarification(10, 0)).toBe(false);
  });
});

describe('QueryClassifier', () => {
  const classifier = QueryClassifier.getInstance();

  it('is a singleton', () => {
    expect(QueryClassifier.getInstance()).toBe(classifier);
  });

  describe('analysis intent', () => {
    it.each([
      '분석해줘',
      '원인이 뭐야',
      'fix this',
      'code review',
      'run script',
      'analysis needed',
      'why is it slow',
    ])('classifies "%s" as analysis', async (query) => {
      const result = await classifier.classify(query);
      expect(result.intent).toBe('analysis');
      expect(result.complexity).toBe(4);
    });
  });

  describe('monitoring intent', () => {
    it.each([
      'cpu usage',
      'memory check',
      'server load',
      '서버 상태',
      '체크해줘',
      'status report',
      'check now',
    ])('classifies "%s" as monitoring', async (query) => {
      const result = await classifier.classify(query);
      expect(result.intent).toBe('monitoring');
      expect(result.complexity).toBe(2);
    });
  });

  describe('problem detection', () => {
    it.each([
      '문제가 있어요',
      '에러 발생',
      'error log',
      'issue found',
      'problem detected',
    ])('classifies "%s" as monitoring with problem reasoning', async (query) => {
      const result = await classifier.classify(query);
      expect(result.intent).toBe('monitoring');
      expect(result.reasoning).toContain('Problem detection');
    });
  });

  describe('default fallback', () => {
    it('returns general intent for unrecognized queries', async () => {
      const result = await classifier.classify('hello world');
      expect(result.intent).toBe('general');
      expect(result.complexity).toBe(1);
      expect(result.reasoning).toBe('Fallback default');
    });
  });

  describe('confidence boosters', () => {
    it('adds +10 for long queries (>50 chars)', async () => {
      const short = await classifier.classify('hello world');
      const long = await classifier.classify(
        'this is a very long query that definitely exceeds fifty characters in total length'
      );
      expect(long.confidence).toBeGreaterThan(short.confidence);
    });

    it('penalizes short queries (<10 chars) with -20', async () => {
      const result = await classifier.classify('hi');
      expect(result.confidence).toBeLessThanOrEqual(55); // 70 - 20 - 15 (fallback) = 35
    });

    it('boosts confidence for server name patterns', async () => {
      const base = await classifier.classify('상태 보여줘');
      const withServer = await classifier.classify('mysql 상태 보여줘');
      expect(withServer.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for time range keywords', async () => {
      const base = await classifier.classify('서버 상태');
      const withTime = await classifier.classify('최근 서버 상태');
      expect(withTime.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for scope keywords', async () => {
      const base = await classifier.classify('서버 상태');
      const withScope = await classifier.classify('모든 서버 상태');
      expect(withScope.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for comparison keywords', async () => {
      const base = await classifier.classify('서버 상태');
      const withComp = await classifier.classify('높은 서버 상태');
      expect(withComp.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for intent clarity keywords', async () => {
      const base = await classifier.classify('서버 상태');
      const withClarity = await classifier.classify('서버 현황 요약');
      expect(withClarity.confidence).toBeGreaterThan(base.confidence);
    });
  });

  describe('confidence clamping', () => {
    it('never exceeds 100', async () => {
      const result = await classifier.classify(
        '모든 mysql 서버의 최근 24시간 높은 cpu 현황 요약 overview all server 전체 상태 확인'
      );
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('never goes below 0', async () => {
      const result = await classifier.classify('ab');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('classifyQuery', () => {
  it('delegates to QueryClassifier singleton', async () => {
    const result = await classifyQuery('cpu usage');
    expect(result.intent).toBe('monitoring');
    expect(result.complexity).toBe(2);
  });
});
