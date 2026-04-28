import { describe, expect, it } from 'vitest';
import { classifyQueryType, type QueryType } from './query-type-classifier';

describe('query type classifier', () => {
  it.each<[string, QueryType]>([
    ['모든 서버 현황 요약해줘', 'STATUS_SUMMARY'],
    ['전체 서버 상태를 핵심만 알려줘', 'STATUS_SUMMARY'],
    ['CPU가 가장 높은 서버 top 3 보여줘', 'RANK_QUERY'],
    ['메모리 상위 5대 순위 알려줘', 'RANK_QUERY'],
    ['CPU 80% 이상인 서버만 보여줘', 'THRESHOLD_QUERY'],
    ['CPU 80 이상인 서버만 보여줘', 'THRESHOLD_QUERY'],
    ['네트워크가 70%를 초과한 서버는?', 'THRESHOLD_QUERY'],
    ['이상 서버 알려줘', 'STATUS_SUMMARY'],
    ['lb-haproxy-dc1-01 상태는?', 'SIMPLE_LOOKUP'],
    ['Redis 캐시 서버 목록 보여줘', 'SIMPLE_LOOKUP'],
  ])('classifies "%s" as %s', (query, expected) => {
    expect(classifyQueryType(query)).toBe(expected);
  });

  it('prioritizes explicit threshold filters over rank wording', () => {
    expect(classifyQueryType('CPU 80% 이상인 서버 중 가장 높은 서버')).toBe(
      'THRESHOLD_QUERY'
    );
  });
});
