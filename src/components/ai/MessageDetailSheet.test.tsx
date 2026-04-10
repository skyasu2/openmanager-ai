/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { MessageDetailSheet } from './MessageDetailSheet';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="detail-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('./MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('./ThinkingProcessVisualizer', () => ({
  ThinkingProcessVisualizer: () => <div data-testid="thinking-visualizer" />,
}));

describe('MessageDetailSheet', () => {
  it('combines summary and details for collapsed responses without duplicating raw content', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: '원문 전체 응답',
      timestamp: new Date('2026-04-10T17:00:00.000Z'),
      isStreaming: false,
      metadata: {
        responseSummary: '핵심 요약',
        responseDetails: '상세 분석 문장',
        responseShouldCollapse: true,
      },
    };

    render(
      <MessageDetailSheet
        open={true}
        onOpenChange={() => {}}
        message={message}
      />
    );

    expect(screen.getByTestId('detail-dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/핵심 요약[\s\S]*상세 분석 문장/)
    ).toBeInTheDocument();
    expect(screen.queryByText('원문 전체 응답')).not.toBeInTheDocument();
  });

  it('omits the full response section when there is no visible assistant content', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-2',
      role: 'assistant',
      content: '',
      timestamp: new Date('2026-04-10T17:10:00.000Z'),
      isStreaming: false,
      thinkingSteps: [
        {
          id: 'step-1',
          title: '분석',
          description: '메타데이터 전용 응답',
          status: 'completed',
        },
      ] as NonNullable<EnhancedChatMessage['thinkingSteps']>,
      metadata: {
        handoffHistory: [{ from: 'Supervisor', to: 'Analyst Agent' }],
      },
    };

    render(
      <MessageDetailSheet
        open={true}
        onOpenChange={() => {}}
        message={message}
      />
    );

    expect(screen.getByTestId('thinking-visualizer')).toBeInTheDocument();
    expect(screen.queryByText('전체 응답')).not.toBeInTheDocument();
  });
});
