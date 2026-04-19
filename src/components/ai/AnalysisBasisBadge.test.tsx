/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisBasis } from '@/stores/useAISidebarStore';
import { AnalysisBasisBadge } from './AnalysisBasisBadge';

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

describe('AnalysisBasisBadge', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
  });

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

  it('renders a concise collapsed summary before expansion', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: '서버 실시간 데이터 분석',
          toolsCalled: ['filterServers', 'getServerMetrics'],
          timeRange: '최근 1시간',
        }}
      />
    );

    expect(
      screen.getByText(
        '도구: 대상 서버 추리기 · 서버 메트릭 조회 · 기간: 최근 1시간'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('응답 과정')).not.toBeInTheDocument();
  });

  it('prioritizes execution path in collapsed summary when handoff exists', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
          timeRange: '최근 1시간',
        }}
        handoffHistory={[
          {
            from: 'supervisor',
            to: 'analyst',
          },
          {
            from: 'analyst',
            to: 'reporter',
          },
        ]}
        toolResultSummaries={[
          {
            toolName: 'searchKnowledgeBase',
            label: 'RAG 지식베이스 검색',
            summary: '2개 결과를 반환했습니다.',
            status: 'completed',
          },
        ]}
      />
    );

    expect(
      screen.getByText(
        '경로: 분석 조율 → 심층 분석 → 보고서 생성 · 도구 1개 · 기간: 최근 1시간'
      )
    ).toBeInTheDocument();
  });

  it('shows selected analysis mode in collapsed summary and expanded details', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: '서버 실시간 데이터 분석',
          analysisMode: 'thinking',
          timeRange: '최근 1시간',
        }}
      />
    );

    expect(
      screen.getByText(
        '데이터: 서버 실시간 데이터 분석 · 모드: Thinking · 기간: 최근 1시간'
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('분석 강도')).toBeInTheDocument();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('shows runtime routing metadata in expanded details when provided', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: '서버 실시간 데이터 분석',
        }}
        processingTime={1987}
        resolvedMode="multi"
        modeSelectionSource="auto_complexity"
        latencyTier="slow"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('실행 특성')).toBeInTheDocument();
    expect(screen.getByText('1987ms')).toBeInTheDocument();
    expect(screen.getByText('Multi 경로')).toBeInTheDocument();
    expect(screen.getByText('지연 느림')).toBeInTheDocument();
    expect(
      screen.getByText('라우팅 근거: 복잡도 자동 판단')
    ).toBeInTheDocument();
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
    expect(screen.getByText('handoff 협업 경로')).toBeInTheDocument();
    expect(screen.getByText('추적 가능 ID')).toBeInTheDocument();
    expect(screen.getByText('trace-1234567890abcdef')).toBeInTheDocument();
    expect(screen.getByText('실행 경로')).toBeInTheDocument();
    expect(screen.getAllByText('분석 조율 → 보고서 생성')).toHaveLength(2);
    expect(screen.getByText('전달 이력')).toBeInTheDocument();
    expect(screen.getByText('도구 결과 요약')).toBeInTheDocument();
    expect(screen.getByText('2개 결과를 반환했습니다.')).toBeInTheDocument();
    expect(screen.getByText('단계별 처리 내역')).toBeInTheDocument();
    expect(screen.getAllByText('내부 지식 검색').length).toBeGreaterThan(0);
    expect(screen.getAllByText('서버 메트릭 조회').length).toBeGreaterThan(0);
    expect(screen.getAllByText('searchKnowledgeBase').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('getServerMetrics').length).toBeGreaterThan(0);
  });

  it('marks fallback recovery and shows structured failure reason codes', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: 'cache-redis-dc1-01 이상 징후 분석',
          toolsCalled: ['detectAnomalies', 'detectAnomaliesAllServers'],
          timeRange: '최근 1시간',
        }}
        toolResultSummaries={[
          {
            toolName: 'detectAnomalies',
            label: '이상 탐지',
            summary: 'cache-redis-dc1-01:9100 서버를 찾을 수 없습니다.',
            preview: '{"serverName":"cache-redis-dc1-01:9100"}',
            status: 'failed',
          },
          {
            toolName: 'detectAnomaliesAllServers',
            label: '전체 서버 이상 탐지',
            summary: '전체 서버 스캔으로 이상 징후 1건을 확인했습니다.',
            status: 'completed',
          },
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('fallback 보정 경로')).toBeInTheDocument();
    expect(screen.getByText('참조 서버')).toBeInTheDocument();
    expect(screen.getByText('cache-redis-dc1-01')).toBeInTheDocument();
    expect(screen.getByText('server-not-found')).toBeInTheDocument();
    expect(screen.getByText('대상 서버 확인 실패')).toBeInTheDocument();
  });

  it('copies a structured debug bundle with normalized server references', async () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: 'cache-redis-dc1-01 메트릭 분석',
          analysisMode: 'thinking',
          toolsCalled: ['detectAnomalies', 'detectAnomaliesAllServers'],
          timeRange: '최근 1시간',
          serverCount: 1,
        }}
        traceId="trace-debug-1234"
        toolResultSummaries={[
          {
            toolName: 'detectAnomalies',
            label: '이상 탐지',
            summary: 'cache-redis-dc1-01:9100 서버를 찾을 수 없습니다.',
            preview: '{"serverName":"cache-redis-dc1-01:9100"}',
            status: 'failed',
          },
          {
            toolName: 'detectAnomaliesAllServers',
            label: '전체 서버 이상 탐지',
            summary: '전체 서버 스캔으로 평균 64.9% → 82% 급증을 확인했습니다.',
            status: 'completed',
          },
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );
    fireEvent.click(screen.getByRole('button', { name: '디버그 번들 복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    const debugBundle = JSON.parse(writeText.mock.calls[0]?.[0] as string);
    expect(debugBundle.route.kind).toBe('fallback-recovery');
    expect(debugBundle.traceId).toBe('trace-debug-1234');
    expect(debugBundle.referencedServers).toContain('cache-redis-dc1-01');
    expect(debugBundle.failureReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'server-not-found',
          toolName: 'detectAnomalies',
        }),
      ])
    );
  });

  it('defaults to the process tab and hides technical trace details until detail is selected', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: '서버 실시간 데이터 분석',
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
        }}
        traceId="trace-process-tab-1234"
        processingTime={1280}
        resolvedMode="multi"
        latencyTier="slow"
        handoffHistory={[
          {
            from: 'supervisor',
            to: 'analyst',
            reason: '이상 징후 원인 분석',
          },
        ]}
        toolResultSummaries={[
          {
            toolName: 'searchKnowledgeBase',
            label: 'RAG 지식베이스 검색',
            summary: '2개 결과를 반환했습니다.',
            status: 'completed',
          },
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(
      screen.getByRole('tab', { name: '과정', selected: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: '상세', selected: false })
    ).toBeInTheDocument();
    expect(screen.getByText('응답 과정')).toBeInTheDocument();
    expect(screen.getByText('실행 특성')).toBeInTheDocument();
    expect(
      screen.queryByText('trace-process-tab-1234')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('searchKnowledgeBase')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '디버그 번들 복사' })
    ).not.toBeInTheDocument();
  });

  it('reveals technical detail content only after switching to the detail tab', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
        }}
        traceId="trace-detail-tab-1234"
        processingTime={1987}
        resolvedMode="multi"
        latencyTier="slow"
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
    fireEvent.click(screen.getByRole('tab', { name: '상세' }));

    expect(
      screen.getByRole('tab', { name: '상세', selected: true })
    ).toBeInTheDocument();
    expect(screen.getByText('추적 가능 ID')).toBeInTheDocument();
    expect(screen.getByText('trace-detail-tab-1234')).toBeInTheDocument();
    expect(screen.getByText('실행 경로')).toBeInTheDocument();
    expect(screen.getByText('searchKnowledgeBase')).toBeInTheDocument();
    expect(screen.getByText('getServerMetrics')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '디버그 번들 복사' })
    ).toBeInTheDocument();
    expect(screen.getByText('1987ms')).toBeInTheDocument();
  });

  it('hides technical details again when returning to the process tab', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['searchKnowledgeBase'],
        }}
        traceId="trace-return-process-1234"
        toolResultSummaries={[
          {
            toolName: 'searchKnowledgeBase',
            label: 'RAG 지식베이스 검색',
            summary: '2개 결과를 반환했습니다.',
            status: 'completed',
          },
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );
    fireEvent.click(screen.getByRole('tab', { name: '상세' }));
    expect(screen.getByText('trace-return-process-1234')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '과정' }));

    expect(
      screen.getByRole('tab', { name: '과정', selected: true })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('trace-return-process-1234')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('searchKnowledgeBase')).not.toBeInTheDocument();
  });

  it('shows an empty-state message in the detail tab when technical metadata is absent', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          dataSource: '서버 실시간 데이터 분석',
        }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );
    fireEvent.click(screen.getByRole('tab', { name: '상세' }));

    expect(screen.getByText('기술 정보 없음')).toBeInTheDocument();
    expect(
      screen.getByText(
        '이번 응답에는 추가 추적 정보나 상세 실행 이력이 없습니다.'
      )
    ).toBeInTheDocument();
  });

  it('keeps a stable tab panel container for layout consistency', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['searchKnowledgeBase'],
        }}
        traceId="trace-stable-panel-1234"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByTestId('analysis-basis-tab-panel')).toHaveClass(
      'min-h-[18rem]'
    );
  });

  // ── Phase 2: handoff 우선 노출 (SDD failing specs) ──────────────────────────

  it('shows handoff count in collapsed summary when handoffHistory is present', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['detectAnomalies'],
          timeRange: '최근 1시간',
        }}
        handoffHistory={[
          { from: 'supervisor', to: 'analyst' },
          { from: 'analyst', to: 'reporter' },
        ]}
        toolResultSummaries={[
          {
            toolName: 'detectAnomalies',
            label: '이상 탐지',
            summary: '정상',
            status: 'completed',
          },
        ]}
      />
    );

    const summary = screen.getByTitle(/handoff 2회/);
    expect(summary).toBeInTheDocument();
  });

  it('shows tool-centric summary when handoffHistory is empty', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          ...basis,
          toolsCalled: ['getServerMetrics'],
          timeRange: '최근 1시간',
        }}
        handoffHistory={[]}
        toolResultSummaries={[
          {
            toolName: 'getServerMetrics',
            label: '서버 메트릭 조회',
            summary: '정상',
            status: 'completed',
          },
        ]}
      />
    );

    const summary = screen.getByText(/도구:/);
    expect(summary).toBeInTheDocument();
    expect(screen.queryByText(/handoff/)).not.toBeInTheDocument();
  });

  it('renders gracefully when both handoffHistory and toolResultSummaries are absent', () => {
    render(
      <AnalysisBasisBadge
        basis={{
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Streaming AI',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/handoff/)).not.toBeInTheDocument();
  });
});
