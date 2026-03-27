/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComponent } from '@/components/ai-sidebar/SidebarMessage';
import { transformMessages } from '@/hooks/ai/utils/message-helpers';

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => null,
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: ({
    basis,
    details,
  }: {
    basis: { dataSource: string; ragUsed?: boolean };
    details?: string | null;
  }) => (
    <div data-testid="analysis-basis-badge" data-details={details ?? ''}>
      <span>{basis.dataSource}</span>
      {basis.ragUsed ? <span>RAG</span> : null}
    </div>
  ),
}));

function createMessage(params: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}): UIMessage {
  return {
    id: params.id,
    role: params.role,
    parts: [{ type: 'text', text: params.text }],
  } as unknown as UIMessage;
}

describe('SidebarMessage RAG badge smoke integration', () => {
  it('renders RAG badge from stream ragSources propagated via transformMessages', () => {
    const ragSources = [
      {
        title: 'Redis OOM 대응 가이드',
        similarity: 0.93,
        sourceType: 'knowledge-base',
        category: 'incident',
        url: 'https://example.com/redis-oom',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'Redis OOM 원인 분석 부탁',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '유사 사례를 기반으로 분석했습니다.',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources: ragSources,
      }
    );

    const assistantMessage = messages.find((message) => message.id === 'a1');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.metadata?.analysisBasis?.ragSources).toEqual(
      ragSources
    );
    expect(assistantMessage?.metadata?.analysisBasis?.dataSource).toContain(
      'RAG 지식베이스 검색'
    );

    render(
      <MessageComponent message={assistantMessage!} isLastMessage={true} />
    );

    const badge = screen.getByTestId('analysis-basis-badge');
    expect(badge).toHaveTextContent('RAG 지식베이스 검색 (1건)');
    expect(badge).toHaveTextContent('RAG');
  });

  it('renders parity metadata inside the analysis basis panel for short streaming answers', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'cache 메모리 사용률 몇 %야?',
        }),
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'cache-redis-dc1-01의 메모리 사용률은 75%입니다.',
            },
            {
              type: 'tool-getServerMetrics',
              toolCallId: 'tool-1',
              output: {
                success: true,
                dataSlot: {
                  slotIndex: 88,
                  minuteOfDay: 880,
                  timeLabel: '14:40 KST',
                },
                dataSource: {
                  scopeName: 'openmanager-ai-otel-pipeline',
                  scopeVersion: '1.0.0',
                  catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
                  hour: 14,
                },
              },
            },
          ],
        } as unknown as UIMessage,
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
      }
    );

    const assistantMessage = messages.find((message) => message.id === 'a1');
    expect(assistantMessage?.metadata?.analysisBasis?.dataSource).toBe(
      '서버 실시간 데이터 분석'
    );

    render(
      <MessageComponent message={assistantMessage!} isLastMessage={true} />
    );

    const badge = screen.getByTestId('analysis-basis-badge');
    expect(badge).toHaveTextContent('서버 실시간 데이터 분석');
    expect(badge.getAttribute('data-details')).toContain(
      'Parity Metadata Contract'
    );
    expect(badge.getAttribute('data-details')).toContain('"slotIndex": 88');
  });
});
