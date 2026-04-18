/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it('trace id copy timer를 unmount 시 정리해야 한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const message: EnhancedChatMessage = {
      id: 'assistant-3',
      role: 'assistant',
      content: '응답',
      timestamp: new Date('2026-04-10T17:20:00.000Z'),
      isStreaming: false,
      metadata: {
        traceId: 'trace-123',
        processingTime: 1987,
        latencyTier: 'slow',
        resolvedMode: 'multi',
        modeSelectionSource: 'auto_complexity',
        analysisBasis: {
          engine: 'ai-engine',
          dataSource: 'otel',
          toolsCalled: [],
        },
      },
    };

    const { unmount } = render(
      <MessageDetailSheet
        open={true}
        onOpenChange={() => {}}
        message={message}
      />
    );

    expect(screen.getByText('처리 시간')).toBeInTheDocument();
    expect(screen.getByText('1987ms')).toBeInTheDocument();
    expect(screen.getByText('라우팅')).toBeInTheDocument();
    expect(screen.getByText('Multi')).toBeInTheDocument();
    expect(screen.getByText('지연 등급')).toBeInTheDocument();
    expect(screen.getByText('느림')).toBeInTheDocument();
    expect(screen.getByText('선택 근거')).toBeInTheDocument();
    expect(screen.getByText('복잡도 자동 판단')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('도구 실행 결과에서 쉬운 라벨과 기술명을 함께 보여준다', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-4',
      role: 'assistant',
      content: '응답',
      timestamp: new Date('2026-04-10T17:30:00.000Z'),
      isStreaming: false,
      metadata: {
        toolResultSummaries: [
          {
            toolName: 'searchKnowledgeBase',
            label: 'RAG 지식베이스 검색',
            summary: '관련 문서 2건을 찾았습니다.',
            status: 'completed',
          },
        ],
      },
    };

    render(
      <MessageDetailSheet
        open={true}
        onOpenChange={() => {}}
        message={message}
      />
    );

    expect(screen.getByText('내부 지식 검색')).toBeInTheDocument();
    expect(screen.getByText('searchKnowledgeBase')).toBeInTheDocument();
  });
});
