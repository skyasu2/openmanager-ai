import { describe, expect, it } from 'vitest';
import { classifyQuery, needsClarification } from './query-classifier';

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

describe('classifyQuery local rules', () => {
  describe('analysis intent', () => {
    it.each([
      '분석해줘',
      '원인이 뭐야',
      'fix this',
      'code review',
      'run script',
      'analysis needed',
      'why is it slow',
    ])('classifies "%s" as analysis', (query) => {
      const result = classifyQuery(query);
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
    ])('classifies "%s" as monitoring', (query) => {
      const result = classifyQuery(query);
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
    ])('classifies "%s" as monitoring with problem reasoning', (query) => {
      const result = classifyQuery(query);
      expect(result.intent).toBe('monitoring');
      expect(result.reasoning).toContain('Problem detection');
    });
  });

  describe('default fallback', () => {
    it('returns general intent for unrecognized queries', () => {
      const result = classifyQuery('hello world');
      expect(result.intent).toBe('general');
      expect(result.complexity).toBe(1);
      expect(result.reasoning).toBe('Fallback default');
    });
  });

  describe('off-domain intent', () => {
    it.each([
      '오늘 서울 날씨 알려줘',
      '환율 알려줘',
      '뉴스 요약해줘',
      '번역해줘',
      '일정 정리해줘',
    ])('classifies "%s" as off-domain best-effort', (query) => {
      const result = classifyQuery(query);
      expect(result.intent).toBe('off-domain');
      expect(result.isOffDomain).toBe(true);
      expect(result.complexity).toBe(1);
    });

    it.each([
      '서버 점검 일정 알려줘',
      'Redis 공식 문서 번역해줘',
      '인프라 아키텍처 일정 정리해줘',
      '서버 장애 알림 Slack으로 공유해줘',
      'CPU 80% 이상 서버를 팀에 메일로 보내는 초안 만들어줘',
    ])('does not classify "%s" as off-domain when infra context exists', (query) => {
      const result = classifyQuery(query);
      expect(result.intent).not.toBe('off-domain');
      expect(result.isOffDomain).not.toBe(true);
    });

    it.each([
      '파이썬 피보나치 코드 짜줘',
      'leetcode two sum 풀어줘',
    ])('classifies general coding query "%s" as off-domain', (query) => {
      const result = classifyQuery(query);

      expect(result.intent).toBe('off-domain');
      expect(result.isOffDomain).toBe(true);
      expect(result.offDomainCategory).toBe('general_coding');
      expect(result.reasoning).toContain('general_coding');
    });

    it.each([
      'Python으로 nginx access log 에러율 집계 스크립트 만들어줘',
      'CPU 사용률 점검 bash 스크립트 알려줘',
      'PromQL로 CPU 80% 이상 서버 찾는 쿼리 알려줘',
    ])('does not classify ops coding query "%s" as off-domain', (query) => {
      const result = classifyQuery(query);

      expect(result.intent).not.toBe('off-domain');
      expect(result.isOffDomain).not.toBe(true);
    });
  });

  describe('confidence boosters', () => {
    it('adds +10 for long queries (>50 chars)', () => {
      const short = classifyQuery('hello world');
      const long = classifyQuery(
        'this is a very long query that definitely exceeds fifty characters in total length'
      );
      expect(long.confidence).toBeGreaterThan(short.confidence);
    });

    it('penalizes short queries (<10 chars) with -20', () => {
      const result = classifyQuery('hi');
      expect(result.confidence).toBeLessThanOrEqual(55); // 70 - 20 - 15 (fallback) = 35
    });

    it('boosts confidence for server name patterns', () => {
      const base = classifyQuery('상태 보여줘');
      const withServer = classifyQuery('mysql 상태 보여줘');
      expect(withServer.confidence).toBeGreaterThan(base.confidence);
    });

    it('treats registered server IDs as explicit scope signals', () => {
      const result = classifyQuery('api-was-dc1-01 CPU 상태 분석해줘');

      expect(result.intent).toBe('analysis');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it('boosts confidence for time range keywords', () => {
      const base = classifyQuery('서버 상태');
      const withTime = classifyQuery('최근 서버 상태');
      expect(withTime.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for scope keywords', () => {
      const base = classifyQuery('서버 상태');
      const withScope = classifyQuery('모든 서버 상태');
      expect(withScope.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for comparison keywords', () => {
      const base = classifyQuery('서버 상태');
      const withComp = classifyQuery('높은 서버 상태');
      expect(withComp.confidence).toBeGreaterThan(base.confidence);
    });

    it('boosts confidence for intent clarity keywords', () => {
      const base = classifyQuery('서버 상태');
      const withClarity = classifyQuery('서버 현황 요약');
      expect(withClarity.confidence).toBeGreaterThan(base.confidence);
    });
  });

  describe('confidence clamping', () => {
    it('never exceeds 100', () => {
      const result = classifyQuery(
        '모든 mysql 서버의 최근 24시간 높은 cpu 현황 요약 overview all server 전체 상태 확인'
      );
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('never goes below 0', () => {
      const result = classifyQuery('ab');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('classifyQuery', () => {
  it('returns classification synchronously without source metadata', () => {
    const result = classifyQuery('cpu usage');

    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toMatchObject({
      intent: 'monitoring',
      complexity: 2,
    });
    expect(result).not.toHaveProperty('source');
  });
});
