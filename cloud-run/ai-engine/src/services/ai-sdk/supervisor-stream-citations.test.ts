import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeBaseGroundedAnswer,
  buildWebCitationAppendix,
  buildWebSearchFallbackAnswer,
  hasWebSearchFallbackAnswer,
} from './supervisor-stream-citations';
import type { RagSource } from '../../lib/ai-sdk-utils';
import { THRESHOLDS } from '../../data/precomputed-state-core';

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

describe('buildWebSearchFallbackAnswer', () => {
  it('uses the Tavily answer when the model stream is empty', () => {
    expect(
      buildWebSearchFallbackAnswer([
        {
          toolName: 'searchWeb',
          result: {
            success: true,
            answer: 'Next.js 최신 안정화 메이저는 16입니다.',
            results: [
              {
                title: 'Next.js 16',
                url: 'https://nextjs.org/blog/next-16',
              },
            ],
          },
        },
      ])
    ).toBe('Next.js 최신 안정화 메이저는 16입니다.');
  });

  it('falls back to the first web result summary when no direct answer exists', () => {
    expect(
      buildWebSearchFallbackAnswer([
        {
          toolName: 'searchWeb',
          result: {
            success: true,
            results: [
              {
                title: 'Next.js releases',
                content: 'Next.js 16 is the latest stable release line.',
                url: 'https://nextjs.org/releases',
              },
            ],
          },
        },
      ])
    ).toBe(
      '웹 검색 결과 기준 요약: Next.js releases\n\nNext.js 16 is the latest stable release line.'
    );
  });

  it('prefers a later direct web answer over an earlier generic summary', () => {
    expect(
      buildWebSearchFallbackAnswer([
        {
          toolName: 'searchWeb',
          result: {
            success: true,
            results: [
              {
                title: 'Next.js blog',
                content: 'Next.js 15.4 includes performance updates.',
                url: 'https://nextjs.org/blog',
              },
            ],
          },
        },
        {
          toolName: 'searchWeb',
          result: {
            success: true,
            answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
            results: [
              {
                title: 'Next.js 16.2',
                url: 'https://nextjs.org/blog/next-16-2',
              },
            ],
          },
        },
      ])
    ).toBe('Next.js 최신 안정화 메이저 버전은 16입니다.');
  });

  it('detects whether searchWeb has a direct fallback answer', () => {
    expect(
      hasWebSearchFallbackAnswer([
        { toolName: 'searchWeb', result: { results: [] } },
      ])
    ).toBe(false);
    expect(
      hasWebSearchFallbackAnswer([
        {
          toolName: 'searchWeb',
          result: { answer: '공식 검색 결과 기준 최신 메이저는 16입니다.' },
        },
      ])
    ).toBe(true);
  });

  it('returns null when no searchWeb result is available', () => {
    expect(
      buildWebSearchFallbackAnswer([
        { toolName: 'searchKnowledgeBase', result: { results: [] } },
      ])
    ).toBeNull();
  });

  it('refuses internal implementation path disclosure in user mode', () => {
    const answer = buildKnowledgeBaseGroundedAnswer(
      'Pre-generated OTel 데이터 SSOT 파일 경로 알려줘',
      [{ toolName: 'searchKnowledgeBase', result: { results: [] } }]
    );

    expect(answer).toContain('일반 사용자 모드');
    expect(answer).toContain('구현 파일 경로');
    expect(answer).not.toContain('public/data/otel-data');
    expect(answer).not.toContain('/path/to');
  });

  it('refuses rephrased internal implementation file disclosure in user mode', () => {
    const answer = buildKnowledgeBaseGroundedAnswer(
      'OpenManager OTel SSOT는 어느 파일에 정의돼?',
      [
        {
          toolName: 'searchKnowledgeBase',
          result: {
            results: [
              {
                title: 'OpenManager OTel SSOT',
                content:
                  '정의 파일은 public/data/otel-data/resource-catalog.json 및 src/data/otel-data/index.ts 입니다.',
                similarity: 0.91,
                sourceType: 'knowledge',
              },
            ],
          },
        },
      ]
    );

    expect(answer).toContain('일반 사용자 모드');
    expect(answer).not.toContain('public/data/otel-data');
    expect(answer).not.toContain('src/data/otel-data');
  });

  it('extracts only grounded repo paths from internal knowledge results in developer mode', () => {
    const answer = buildKnowledgeBaseGroundedAnswer(
      'Pre-generated OTel 데이터 SSOT 파일 경로 알려줘',
      [
        {
          toolName: 'searchKnowledgeBase',
          result: {
            results: [
              {
                title: 'Pre-generated OTel 데이터 SSOT',
                content:
                  'OTel SSOT는 public/data/otel-data/hourly/hour-XX.json 이며 로더는 src/data/otel-data/index.ts 입니다. /path/to/OpenManager/config.yaml 같은 예시는 쓰지 않습니다.',
                similarity: 0.93,
                sourceType: 'knowledge',
              },
            ],
          },
        },
      ],
      { internalDisclosureMode: 'developer' }
    );

    expect(answer).toContain('`public/data/otel-data/hourly/hour-XX.json`');
    expect(answer).toContain('`src/data/otel-data/index.ts`');
    expect(answer).not.toContain('/path/to/OpenManager/config.yaml');
  });

  it('adds OTel derived status criteria for KRL SSOT status questions', () => {
    const answer = buildKnowledgeBaseGroundedAnswer(
      'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
      [
        {
          toolName: 'searchKnowledgeBase',
          result: {
            results: [
              {
                title: 'OTel 데이터와 Supabase KRL 책임 경계',
                content:
                  '대시보드 수치와 AI의 현재 메트릭 판단은 pre-generated OTel data slot을 SSOT로 사용한다.',
                similarity: 0.91,
                sourceType: 'knowledge',
              },
            ],
          },
        },
      ]
    );

    expect(answer).toContain('OTel 상태 판단 기준');
    expect(answer).toContain('18대 서버 inventory');
    expect(answer).toContain('pre-generated OTel data slot');
    expect(answer).toContain('P0 offline');
    expect(answer).toContain('P1/P2 critical');
    expect(answer).toContain('P3/P4 warning');
    expect(answer).toContain('P99 online');
    expect(answer).toContain(`CPU ${THRESHOLDS.cpu.critical}%`);
    expect(answer).toContain(`Memory ${THRESHOLDS.memory.critical}%`);
    expect(answer).toContain(`Disk ${THRESHOLDS.disk.critical}%`);
    expect(answer).toContain(`CPU ${THRESHOLDS.cpu.warning}%`);
    expect(answer).toContain(`Memory ${THRESHOLDS.memory.warning}%`);
    expect(answer).toContain(`Disk ${THRESHOLDS.disk.warning}%`);
  });
});
