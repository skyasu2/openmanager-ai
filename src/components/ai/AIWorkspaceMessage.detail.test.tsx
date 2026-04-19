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

vi.mock('@/components/ai/MessageDetailSheet', () => ({
  MessageDetailSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="message-detail-sheet" /> : null,
}));

describe('AIWorkspaceMessage detail affordance', () => {
  it('shows the detail dialog trigger for metadata-only assistant messages without rendering content actions', () => {
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

    expect(
      screen.getByTestId('message-detail-expand-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ai-response')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('message-detail-expand-button'));

    expect(screen.getByTestId('message-detail-sheet')).toBeInTheDocument();
  });

  it('keeps the detail dialog trigger when only structured response metadata exists', () => {
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

    expect(
      screen.getByTestId('message-detail-expand-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
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
      screen.getByRole('tab', { name: '과정', selected: true })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '상세' }));

    expect(
      screen.getByText('trace-workspace-integration-1234')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tabpanel', { name: '상세' })).getByText('1280ms')
    ).toBeInTheDocument();
  });
});
