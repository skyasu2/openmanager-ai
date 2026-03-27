import { describe, expect, it } from 'vitest';
import { extractRagSources } from './ai-sdk-utils';

describe('extractRagSources', () => {
  it('maps searchKnowledgeBase similarCases to ragSources', () => {
    const output = {
      similarCases: [
        {
          title: 'Redis OOM incident',
          similarity: 0.92,
          sourceType: 'knowledge-base',
          category: 'incident',
        },
        {
          name: 'CPU throttle runbook',
          score: '0.78',
          type: 'graph',
        },
      ],
    };

    const result = extractRagSources('searchKnowledgeBase', output);

    expect(result).toEqual([
      {
        title: 'Redis OOM incident',
        similarity: 0.92,
        sourceType: 'knowledge-base',
        category: 'incident',
      },
      {
        title: 'CPU throttle runbook',
        similarity: 0.78,
        sourceType: 'graph',
        category: undefined,
      },
    ]);
  });

  it('supports legacy results field for searchKnowledgeBase', () => {
    const output = {
      results: [{ title: 'Legacy KB', score: 0.65, type: 'vector' }],
    };

    const result = extractRagSources('searchKnowledgeBase', output);

    expect(result).toEqual([
      {
        title: 'Legacy KB',
        similarity: 0.65,
        sourceType: 'vector',
        category: undefined,
      },
    ]);
  });

  it('maps searchWeb results with url metadata', () => {
    const output = {
      results: [
        {
          title: 'Redis memory tuning',
          score: 0.88,
          url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/',
        },
      ],
    };

    const result = extractRagSources('searchWeb', output);

    expect(result).toEqual([
      {
        title: 'Redis memory tuning',
        similarity: 0.88,
        sourceType: 'web',
        category: 'web-search',
        url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/',
      },
    ]);
  });

  it('returns empty array for unsupported tool or malformed output', () => {
    expect(extractRagSources('unknownTool', { foo: 'bar' })).toEqual([]);
    expect(extractRagSources('searchKnowledgeBase', null)).toEqual([]);
    expect(extractRagSources('searchWeb', { results: 'invalid' })).toEqual([]);
  });
});
