import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { normalizeAIResponse } from '@/lib/ai/utils/message-normalizer';
import { transformMessages } from './message-helpers';

type RagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

function createMessage(params: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  metadata?: {
    traceId?: string;
    ragSources?: RagSource[];
  };
}): UIMessage {
  return {
    id: params.id,
    role: params.role,
    parts: [{ type: 'text', text: params.text }],
    ...(params.metadata ? { metadata: params.metadata } : {}),
  } as unknown as UIMessage;
}

describe('transformMessages', () => {
  it('keeps metadata ragSources with Cloud Run engine in job-queue mode', () => {
    const ragSources: RagSource[] = [
      {
        title: 'incident memory pressure',
        similarity: 0.91,
        sourceType: 'vector',
        category: 'incident',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'why memory issue?' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'analysis result',
          metadata: { ragSources, traceId: 'trace-1' },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant).toBeDefined();
    expect(assistant?.metadata?.analysisBasis?.engine).toBe('Cloud Run AI');
    expect(assistant?.metadata?.analysisBasis?.ragSources).toEqual(ragSources);
    expect(assistant?.metadata?.analysisBasis?.dataSource).toContain(
      'RAG 지식베이스 검색'
    );
  });

  it('uses streamRagSources fallback for the last assistant message', () => {
    const streamRagSources: RagSource[] = [
      {
        title: 'official runbook',
        similarity: 0.88,
        sourceType: 'web',
        url: 'https://example.com/runbook',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'what is latest fix?' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'streamed response',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources,
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant).toBeDefined();
    expect(assistant?.metadata?.analysisBasis?.engine).toBe('Streaming AI');
    expect(assistant?.metadata?.analysisBasis?.ragSources).toEqual(
      streamRagSources
    );
    expect(assistant?.metadata?.analysisBasis?.dataSource).toContain('웹 검색');
  });

  it('applies streamRagSources only to last message', () => {
    const streamRagSources: RagSource[] = [
      {
        title: 'fallback source',
        similarity: 0.8,
        sourceType: 'web',
        url: 'https://example.com/fallback',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'test query' }),
        createMessage({ id: 'a1', role: 'assistant', text: 'first answer' }),
        createMessage({ id: 'a2', role: 'assistant', text: 'second answer' }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources,
      }
    );

    const firstAssistant = messages.find((m) => m.id === 'a1');
    const lastAssistant = messages.find((m) => m.id === 'a2');

    expect(firstAssistant?.metadata?.analysisBasis?.ragSources).toBeUndefined();
    expect(lastAssistant?.metadata?.analysisBasis?.ragSources).toEqual(
      streamRagSources
    );
  });
});

describe('normalizeAIResponse', () => {
  it('extracts answer field from JSON response', () => {
    const json = JSON.stringify({
      answer: '서버 15대 중 경고 1대',
      confidence: 0.93,
      toolsUsed: ['getServerMetrics'],
    });
    expect(normalizeAIResponse(json)).toBe('서버 15대 중 경고 1대');
  });

  it('extracts response field from Cloud Run JSON', () => {
    const json = JSON.stringify({
      response: '분석 결과입니다',
      success: true,
    });
    expect(normalizeAIResponse(json)).toBe('분석 결과입니다');
  });

  it('returns plain text as-is', () => {
    const text = '일반 텍스트 응답입니다';
    expect(normalizeAIResponse(text)).toBe(text);
  });

  it('returns markdown as-is', () => {
    const md = '## 서버 현황\n- CPU: 45%\n- MEM: 60%';
    expect(normalizeAIResponse(md)).toBe(md);
  });

  it('returns original for unrecognized JSON structure', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(normalizeAIResponse(json)).toBe(json);
  });

  it('handles empty/null input gracefully', () => {
    expect(normalizeAIResponse('')).toBe('');
    expect(normalizeAIResponse(null as unknown as string)).toBe(null);
  });
});
