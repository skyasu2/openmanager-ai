import { describe, expect, it } from 'vitest';
import { buildWebCitationAppendix } from './supervisor-stream-citations';
import type { RagSource } from '../../lib/ai-sdk-utils';

describe('buildWebCitationAppendix', () => {
  it('appends web source links when the answer has no citation URL', () => {
    const sources: RagSource[] = [
      {
        title: 'Next.js releases',
        similarity: 0.9,
        sourceType: 'web',
        url: 'https://nextjs.org/releases',
      },
    ];

    expect(buildWebCitationAppendix('최신 stable release는 검색 결과 기준입니다.', sources)).toBe(
      '\n\n참고 출처\n- [Next.js releases](https://nextjs.org/releases)'
    );
  });

  it('does not duplicate citations when the answer already includes a URL', () => {
    const sources: RagSource[] = [
      {
        title: 'Next.js docs',
        similarity: 0.9,
        sourceType: 'web',
        url: 'https://nextjs.org/docs',
      },
    ];

    expect(
      buildWebCitationAppendix('출처: https://nextjs.org/docs', sources)
    ).toBe('');
  });

  it('ignores non-web sources and duplicate urls', () => {
    const sources: RagSource[] = [
      {
        title: 'Internal KB',
        similarity: 0.8,
        sourceType: 'knowledge',
      },
      {
        title: 'Source A',
        similarity: 0.9,
        sourceType: 'web',
        url: 'https://example.com/a',
      },
      {
        title: 'Source A duplicate',
        similarity: 0.7,
        sourceType: 'web',
        url: 'https://example.com/a',
      },
    ];

    expect(buildWebCitationAppendix('요약', sources)).toBe(
      '\n\n참고 출처\n- [Source A](https://example.com/a)'
    );
  });
});
