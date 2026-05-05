import { describe, expect, it } from 'vitest';
import {
  extractEvidenceCards,
  extractRagSources,
  extractRetrievalMetadata,
  extractToolResultOutput,
} from './ai-sdk-utils';

describe('extractToolResultOutput', () => {
  it('supports legacy result and AI SDK v6 output fields', () => {
    expect(extractToolResultOutput({ result: { success: true } })).toEqual({
      success: true,
    });
    expect(extractToolResultOutput({ output: { success: true } })).toEqual({
      success: true,
    });
  });

  it('unwraps AI SDK typed output envelopes', () => {
    expect(
      extractToolResultOutput({
        output: {
          type: 'json',
          value: {
            success: true,
            answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
            results: [{ title: 'Next.js 16.2' }],
          },
        },
      })
    ).toEqual({
      success: true,
      answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
      results: [{ title: 'Next.js 16.2' }],
    });

    expect(
      extractToolResultOutput({
        output: { type: 'text', value: 'final answer' },
      })
    ).toBe('final answer');
  });
});

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

  it('maps supported tool output into EvidenceCard contract', () => {
    const result = extractEvidenceCards('searchKnowledgeBase', {
      similarCases: [
        {
          title: 'CPU throttle runbook',
          score: 0.78,
          type: 'graph',
          category: 'runbook',
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 'legacy-rag-0-cpu-throttle-runbook',
        title: 'CPU throttle runbook',
        summary: 'CPU throttle runbook',
        sourceType: 'runbook',
        score: 0.78,
        category: 'runbook',
        reason: 'legacy-rag-source:graph',
      },
    ]);
  });

  it('prefers direct EvidenceCard contract when tool output provides it', () => {
    const result = extractEvidenceCards('searchKnowledgeBase', {
      evidenceCards: [
        {
          id: 'kb-redis',
          title: 'Redis connection runbook',
          summary: 'Redis connection troubleshooting',
          sourceType: 'runbook',
          score: 0.88,
          category: 'troubleshooting',
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 'kb-redis',
        title: 'Redis connection runbook',
        summary: 'Redis connection troubleshooting',
        sourceType: 'runbook',
        score: 0.88,
        category: 'troubleshooting',
      },
    ]);
  });

  it('extracts Knowledge Retrieval Lite metadata from searchKnowledgeBase output', () => {
    const result = extractRetrievalMetadata('searchKnowledgeBase', {
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
    });

    expect(result).toEqual({
      retrievalEnabled: true,
      retrievalUsed: true,
      retrievalMode: 'lite',
      evidenceCount: 2,
      webUsed: false,
    });
  });
});
