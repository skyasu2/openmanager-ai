/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import type { AnalysisBasis } from '@/stores/useAISidebarStore';
import { AnalysisBasisBadge } from './AnalysisBasisBadge';

void React;

describe('AnalysisBasisBadge', () => {
  const basis: AnalysisBasis = {
    dataSource: 'RAG 지식베이스 검색 (2건)',
    engine: 'Cloud Run AI',
    ragUsed: true,
    confidence: 90,
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
});
