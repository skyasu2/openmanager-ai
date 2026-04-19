/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComponent } from '@/components/ai-sidebar/SidebarMessage';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

vi.mock('@/components/ai/WebSourceCards', () => ({
  WebSourceCards: () => null,
}));

vi.mock('@/components/ai/MessageDetailSheet', () => ({
  MessageDetailSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="message-detail-sheet" /> : null,
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

function createAssistantMessage(): EnhancedChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: '핵심 요약 문장',
    timestamp: new Date('2026-03-18T12:00:00.000Z'),
    isStreaming: false,
    metadata: {
      responseSummary: '핵심 요약 문장',
      responseDetails: '상세 분석 첫 줄\n상세 분석 둘째 줄',
      responseShouldCollapse: true,
    },
  };
}

function createMetadataOnlyAssistantMessage(): EnhancedChatMessage {
  return {
    id: 'assistant-2',
    role: 'assistant',
    content: '',
    timestamp: new Date('2026-03-18T12:10:00.000Z'),
    isStreaming: false,
    metadata: {
      handoffHistory: [{ from: 'Supervisor', to: 'Analyst Agent' }],
    },
    thinkingSteps: [
      {
        id: 'step-1',
        title: '분석 중',
        description: '메타데이터만 있는 응답을 처리합니다.',
        status: 'completed',
      },
    ] as NonNullable<EnhancedChatMessage['thinkingSteps']>,
  };
}

describe('SidebarMessage detail expand', () => {
  it('hides detailed analysis until the toggle is clicked', () => {
    render(
      <MessageComponent
        message={createAssistantMessage()}
        isLastMessage={true}
      />
    );

    expect(screen.getByText('핵심 요약')).toBeInTheDocument();
    expect(screen.getByText('핵심 요약 문장')).toBeInTheDocument();
    expect(screen.queryByText('상세 분석 첫 줄')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('message-detail-expand-button')
    ).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', {
      name: /상세 분석 보기/i,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/상세 분석 첫 줄/)).toBeInTheDocument();
    expect(screen.getByText(/상세 분석 둘째 줄/)).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/상세 분석 첫 줄/)).not.toBeInTheDocument();
  });

  it('shows the detail dialog trigger even without analysisBasis metadata', () => {
    render(
      <MessageComponent
        message={createAssistantMessage()}
        isLastMessage={true}
      />
    );

    fireEvent.click(screen.getByTestId('message-detail-expand-button'));

    expect(screen.getByTestId('message-detail-sheet')).toBeInTheDocument();
  });

  it('shows the detail dialog trigger for metadata-only assistant messages without rendering content actions', () => {
    render(
      <MessageComponent
        message={createMetadataOnlyAssistantMessage()}
        isLastMessage={true}
      />
    );

    expect(
      screen.getByTestId('message-detail-expand-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('message-detail-expand-button'));

    expect(screen.getByTestId('message-detail-sheet')).toBeInTheDocument();
  });

  it('keeps the detail dialog trigger when only structured response metadata exists', () => {
    render(
      <MessageComponent
        message={{
          id: 'assistant-3',
          role: 'assistant',
          content: '',
          timestamp: new Date('2026-03-18T12:15:00.000Z'),
          isStreaming: false,
          metadata: {
            assistantResponseView: {
              summary: '핵심 요약 메타데이터',
              details: '상세 메타데이터 본문',
              shouldCollapse: true,
            },
          },
        }}
        isLastMessage={true}
      />
    );

    expect(
      screen.getByTestId('message-detail-expand-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('renders the real analysis basis tabs for assistant messages with analysis metadata', () => {
    render(
      <MessageComponent
        message={{
          id: 'assistant-4',
          role: 'assistant',
          content: 'CPU 이상 징후를 분석했습니다.',
          timestamp: new Date('2026-04-19T05:20:00.000Z'),
          isStreaming: false,
          metadata: {
            traceId: 'trace-sidebar-integration-1234',
            analysisBasis: {
              dataSource: '서버 실시간 데이터 분석',
              engine: 'Cloud Run AI',
              toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
            },
            handoffHistory: [{ from: 'supervisor', to: 'reporter' }],
            toolResultSummaries: [
              {
                toolName: 'searchKnowledgeBase',
                label: 'RAG 지식베이스 검색',
                summary: '2개 결과를 반환했습니다.',
                status: 'completed',
              },
            ],
          },
        }}
        isLastMessage={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(
      screen.getByRole('tab', { name: '과정', selected: true })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '상세' }));

    expect(
      screen.getByText('trace-sidebar-integration-1234')
    ).toBeInTheDocument();
  });
});
