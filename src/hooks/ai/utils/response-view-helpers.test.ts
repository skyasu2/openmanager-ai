/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  buildStructuredResponseView,
  normalizeRagSources,
  type ResponseSourceData,
} from './response-view-helpers';

describe('normalizeRagSources', () => {
  it('should return null for null input', () => {
    expect(normalizeRagSources(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(normalizeRagSources(undefined)).toBeNull();
  });

  it('should return null for non-array input', () => {
    expect(normalizeRagSources('string')).toBeNull();
    expect(normalizeRagSources(42)).toBeNull();
    expect(normalizeRagSources({ key: 'value' })).toBeNull();
  });

  it('should return the array for valid array input', () => {
    const sources = [
      { title: 'doc1', similarity: 0.9, sourceType: 'knowledge_base' },
      {
        title: 'doc2',
        similarity: 0.8,
        sourceType: 'web',
        category: 'tutorial',
        url: 'https://example.com',
      },
    ];
    expect(normalizeRagSources(sources)).toEqual(sources);
  });

  it('should return empty array for empty array input', () => {
    expect(normalizeRagSources([])).toEqual([]);
  });
});

describe('buildStructuredResponseView', () => {
  it('should return null for undefined input', () => {
    expect(buildStructuredResponseView(undefined)).toBeNull();
  });

  it('should return structured view when responseSummary is present', () => {
    const doneData: ResponseSourceData = {
      responseSummary: 'CPU 사용률이 높습니다.',
      responseDetails: '서버 web-01의 CPU가 95%에 달했습니다.',
      responseShouldCollapse: true,
    };

    const result = buildStructuredResponseView(doneData);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('CPU 사용률이 높습니다.');
    expect(result?.details).toBe('서버 web-01의 CPU가 95%에 달했습니다.');
    expect(result?.shouldCollapse).toBe(true);
  });

  it('should return structured view when summary (shorthand) is present', () => {
    const doneData: ResponseSourceData = {
      summary: '요약 텍스트',
      details: '상세 내용',
      shouldCollapse: false,
    };

    const result = buildStructuredResponseView(doneData);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('요약 텍스트');
  });

  it('should return null when summary is empty string', () => {
    const doneData: ResponseSourceData = {
      responseSummary: '   ',
    };

    expect(buildStructuredResponseView(doneData)).toBeNull();
  });

  it('should return null when no summary fields exist', () => {
    const doneData: ResponseSourceData = {
      ragSources: [{ title: 'doc', similarity: 0.9, sourceType: 'kb' }],
    };

    expect(buildStructuredResponseView(doneData)).toBeNull();
  });

  it('should handle assistantResponseView object in data', () => {
    const doneData: ResponseSourceData = {
      assistantResponseView: {
        summary: '구조화된 요약',
        details: '상세 분석 내용',
        shouldCollapse: true,
      },
    };

    const result = buildStructuredResponseView(doneData);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('구조화된 요약');
    expect(result?.details).toBe('상세 분석 내용');
    expect(result?.shouldCollapse).toBe(true);
  });
});
