/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComponent } from '@/components/ai-sidebar/SidebarMessage';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => null,
}));

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: () => null,
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
});
