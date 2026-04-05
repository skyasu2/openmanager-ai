/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisBasis } from '@/stores/useAISidebarStore';
import { AnalysisBasisBadge } from './AnalysisBasisBadge';

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

describe('AnalysisBasisBadge', () => {
  const basis: AnalysisBasis = {
    dataSource: 'RAG 지식베이스 검색 (2건)',
    engine: 'Cloud Run AI',
    ragUsed: true,
    ragSources: [
      {
        title: 'Redis OOM incident',
        similarity: 0.91,
        sourceType: 'knowledge-base',
        category: 'incident',
      },
      {
        title: 'Redis memory tuning',
        similarity: 0.88,
        sourceType: 'web',
        url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/',
      },
    ],
  };

  it('renders RAG sources when expanded', () => {
    render(<AnalysisBasisBadge basis={basis} />);

    expect(screen.getByText('분석 근거')).toBeInTheDocument();
    expect(screen.queryByText('RAG 참조 문서')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('RAG 참조 문서')).toBeInTheDocument();
    expect(screen.getByText('Cloud Run AI')).toBeInTheDocument();
    expect(screen.getByText('RAG')).toBeInTheDocument();
    expect(screen.getByText('Redis OOM incident')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();

    const webLink = screen.getByRole('link', { name: 'Redis memory tuning' });
    expect(webLink).toHaveAttribute(
      'href',
      'https://redis.io/docs/latest/operate/oss_and_stack/management/'
    );
    expect(screen.getByText('redis.io')).toBeInTheDocument();
  });

  it('renders supplemental parity details when provided', () => {
    render(
      <AnalysisBasisBadge
        basis={basis}
        details={`### Parity Metadata Contract\n\`\`\`json\n{ "dataSlot": { "slotIndex": 88 } }\n\`\`\``}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('추가 메타데이터')).toBeInTheDocument();
    expect(screen.getByText(/Parity Metadata Contract/)).toBeInTheDocument();
    expect(screen.getByText(/slotIndex/)).toBeInTheDocument();
  });

  it('renders detailed response process when expanded', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
        }}
        traceId="trace-1234567890abcdef"
        handoffHistory={[
          {
            from: 'supervisor',
            to: 'reporter',
            reason: '운영 요약 생성을 위해 reporter로 전달',
          },
        ]}
        toolResultSummaries={[
          {
            toolName: 'searchKnowledgeBase',
            label: 'RAG 지식베이스 검색',
            summary: '2개 결과를 반환했습니다.',
            preview: '{"results":[{"title":"Redis OOM incident"}]}',
            status: 'completed',
          },
        ]}
        thinkingSteps={[
          {
            id: 'step-1',
            step: 'searchKnowledgeBase',
            status: 'completed',
            description: '과거 장애 문서를 조회했습니다.',
            duration: 180,
          },
          {
            id: 'step-2',
            step: 'getServerMetrics',
            status: 'completed',
            description: '실시간 메트릭을 확인했습니다.',
            duration: 90,
          },
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('응답 과정')).toBeInTheDocument();
    expect(screen.getByText('Trace ID')).toBeInTheDocument();
    expect(screen.getByText('trace-1234567890abcdef')).toBeInTheDocument();
    expect(screen.getByText('에이전트 전달 경로')).toBeInTheDocument();
    expect(screen.getByText('supervisor → reporter')).toBeInTheDocument();
    expect(screen.getByText('도구 결과 요약')).toBeInTheDocument();
    expect(screen.getByText('2개 결과를 반환했습니다.')).toBeInTheDocument();
    expect(screen.getByText('단계별 처리 내역')).toBeInTheDocument();
    expect(screen.getByText('searchKnowledgeBase')).toBeInTheDocument();
    expect(screen.getByText('getServerMetrics')).toBeInTheDocument();
  });
});
