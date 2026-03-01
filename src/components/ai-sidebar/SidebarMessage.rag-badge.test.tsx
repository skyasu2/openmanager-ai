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

    expect(screen.getByText('RAG')).toBeInTheDocument();
    expect(screen.getByText('RAG 지식베이스 검색 (1건)')).toBeInTheDocument();
  });
});
