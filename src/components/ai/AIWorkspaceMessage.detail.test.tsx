/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { AIWorkspaceMessage } from './AIWorkspaceMessage';

vi.mock('./MessageActions', () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

vi.mock('./MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('./TypewriterMarkdown', () => ({
  TypewriterMarkdown: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

vi.mock('./ThinkingProcessVisualizer', () => ({
  ThinkingProcessVisualizer: () => <div data-testid="thinking-visualizer" />,
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

describe('AIWorkspaceMessage detail affordance', () => {
  it('renders structured details inline when analysis metadata is absent', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-inline-details',
      role: 'assistant',
      content: '핵심 요약 메타데이터',
      timestamp: new Date('2026-04-10T17:02:00.000Z'),
      isStreaming: false,
      metadata: {
        assistantResponseView: {
          summary: '핵심 요약 메타데이터',
          details: '상세 메타데이터 본문',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('핵심 요약 메타데이터')).toBeInTheDocument();
    expect(screen.getByText('상세 메타데이터 본문')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
  });

  it('keeps metadata-only assistant messages free of content actions', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      timestamp: new Date('2026-04-10T17:00:00.000Z'),
      isStreaming: false,
      metadata: {
        handoffHistory: [{ from: 'Supervisor', to: 'Analyst Agent' }],
      },
      thinkingSteps: [
        {
          id: 'step-1',
          title: '분석',
          description: '메타데이터 전용 응답',
          status: 'completed',
        },
      ] as NonNullable<EnhancedChatMessage['thinkingSteps']>,
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.queryByTestId('ai-response')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('keeps structured-response-only assistant messages free of content actions', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-2',
      role: 'assistant',
      content: '',
      timestamp: new Date('2026-04-10T17:05:00.000Z'),
      isStreaming: false,
      metadata: {
        assistantResponseView: {
          summary: '핵심 요약 메타데이터',
          details: '상세 메타데이터 본문',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
  });

  it('does not render an empty thinking visualizer when thinking steps are empty', () => {
    const message: EnhancedChatMessage = {
      id: 'thinking-1',
      role: 'thinking',
      content: '',
      timestamp: new Date('2026-04-10T17:10:00.000Z'),
      isStreaming: true,
      thinkingSteps: [],
    };

    const { container } = render(
      <AIWorkspaceMessage message={message} isLastMessage={true} />
    );

    expect(screen.queryByTestId('thinking-visualizer')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the real analysis basis tabs in the workspace assistant surface', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-3',
      role: 'assistant',
      content: '캐시 서버 상태를 요약했습니다.',
      timestamp: new Date('2026-04-10T17:15:00.000Z'),
      isStreaming: false,
      metadata: {
        traceId: 'trace-workspace-integration-1234',
        processingTime: 1280,
        latencyTier: 'slow',
        resolvedMode: 'multi',
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
        },
        handoffHistory: [{ from: 'supervisor', to: 'analyst' }],
        toolResultSummaries: [
          {
            toolName: 'getServerMetrics',
            label: '서버 메트릭 조회',
            summary: '현재 CPU와 메모리를 확인했습니다.',
            status: 'completed',
          },
        ],
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(
      screen.getByRole('tab', { name: '과정 보기', selected: true })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(
      screen.getByText('trace-workspace-integration-1234')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tabpanel', { name: '디버그 보기' })).getByText(
        '1280ms'
      )
    ).toBeInTheDocument();
  });

  it('moves parity metadata into the debug tab when analysis metadata exists', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-4',
      role: 'assistant',
      content: '슬롯 parity를 확인했습니다.',
      timestamp: new Date('2026-04-10T17:16:00.000Z'),
      isStreaming: false,
      metadata: {
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
        },
        assistantResponseView: {
          summary: '슬롯 parity를 확인했습니다.',
          details:
            '일반 설명\n\n### Parity Metadata Contract\n```json\n{ "dataSlot": { "slotIndex": 105 } }\n```',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(
      screen.queryByText('Parity Metadata Contract')
    ).not.toBeInTheDocument();
    expect(screen.getByText('일반 설명')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(screen.getByText(/Parity Metadata Contract/)).toBeInTheDocument();
  });

  it('shows actionable details inline when analysis metadata exists', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-5',
      role: 'assistant',
      content: '위험 서버를 분석했습니다.',
      timestamp: new Date('2026-04-30T03:40:00.000Z'),
      isStreaming: false,
      metadata: {
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
        },
        assistantResponseView: {
          summary: '위험 서버를 분석했습니다.',
          details:
            'db-mysql-dc1-primary MEM 90%\n\n1. 커넥션 풀과 버퍼 캐시를 확인',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('상세 분석')).toBeInTheDocument();
    expect(
      screen.getByText(/db-mysql-dc1-primary MEM 90%/)
    ).toBeInTheDocument();
    expect(screen.getByText(/커넥션 풀과 버퍼 캐시/)).toBeInTheDocument();
  });
});
