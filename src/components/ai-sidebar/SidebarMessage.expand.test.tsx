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

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: () => null,
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
});
