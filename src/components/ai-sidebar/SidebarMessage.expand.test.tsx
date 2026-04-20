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
  it('renders detailed analysis inline when analysis metadata is absent', () => {
    render(
      <MessageComponent
        message={createAssistantMessage()}
        isLastMessage={true}
      />
    );

    expect(screen.getByText('핵심 요약')).toBeInTheDocument();
    expect(screen.getByText('핵심 요약 문장')).toBeInTheDocument();
    expect(screen.getByText(/상세 분석 첫 줄/)).toBeInTheDocument();
    expect(screen.getByText(/상세 분석 둘째 줄/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
  });

  it('does not render a separate detail modal trigger anymore', () => {
    render(
      <MessageComponent
        message={createAssistantMessage()}
        isLastMessage={true}
      />
    );

    expect(
      screen.queryByTestId('message-detail-expand-button')
    ).not.toBeInTheDocument();
  });

  it('keeps metadata-only assistant messages free of content actions', () => {
    render(
      <MessageComponent
        message={createMetadataOnlyAssistantMessage()}
        isLastMessage={true}
      />
    );

    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('keeps structured-response-only assistant messages free of content actions', () => {
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

    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
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
      screen.getByRole('tab', { name: '과정 보기', selected: true })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(
      screen.getByText('trace-sidebar-integration-1234')
    ).toBeInTheDocument();
  });

  it('moves parity metadata into the debug tab when analysis metadata exists', () => {
    render(
      <MessageComponent
        message={{
          id: 'assistant-5',
          role: 'assistant',
          content: '메트릭 parity를 확인했습니다.',
          timestamp: new Date('2026-04-19T05:20:00.000Z'),
          isStreaming: false,
          metadata: {
            analysisBasis: {
              dataSource: '서버 실시간 데이터 분석',
              engine: 'Cloud Run AI',
            },
            assistantResponseView: {
              summary: '메트릭 parity를 확인했습니다.',
              details:
                '일반 설명 문단\n\n### Parity Metadata Contract\n```json\n{ "dataSlot": { "slotIndex": 105 } }\n```',
              shouldCollapse: true,
            },
          },
        }}
        isLastMessage={true}
      />
    );

    expect(
      screen.queryByText('Parity Metadata Contract')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(screen.getByText('일반 설명 문단')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(screen.getByText(/Parity Metadata Contract/)).toBeInTheDocument();
  });
});
