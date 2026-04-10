/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: () => null,
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
});
