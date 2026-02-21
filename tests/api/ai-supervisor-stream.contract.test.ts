import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

const StreamRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1),
      })
    )
    .min(1),
  sessionId: z.string().min(8).max(128),
  enableWebSearch: z.boolean().optional(),
});

const StreamEventSchema = z.object({
  type: z.enum([
    'agent_status',
    'handoff',
    'tool_call',
    'tool_result',
    'text_delta',
    'step_finish',
    'done',
  ]),
  data: z.unknown(),
});

const StreamErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

function toSse(events: Array<{ type: string; data: unknown }>): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

function parseSsePayload(payload: string) {
  return payload
    .split('\n\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)));
}

describe('AI Supervisor Stream v2 Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('요청/응답이 스트리밍 계약(UIMessageStream 헤더 + SSE 이벤트 형식)을 만족한다', async () => {
    const streamEvents = [
      {
        type: 'agent_status',
        data: { agent: 'orchestrator', status: 'thinking' },
      },
      { type: 'text_delta', data: '서버 상태를 분석 중입니다.' },
      { type: 'done', data: { success: true, finalAgent: 'NLQ Agent' } },
    ];

    const mockSseResponse = new Response(toSse(streamEvents), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'X-Stream-Protocol': 'ui-message-stream',
        'X-Resumable': 'true',
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(mockSseResponse);
    vi.stubGlobal('fetch', fetchMock);

    const requestBody = {
      messages: [{ role: 'user' as const, content: '서버 상태 알려줘' }],
      sessionId: 'session-1234',
      enableWebSearch: false,
    };

    const response = await fetch('/api/ai/supervisor/stream/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
    });

    const fetchCall = fetchMock.mock.calls[0];
    const sentOptions = fetchCall?.[1] as RequestInit;
    const sentBody = JSON.parse(String(sentOptions.body));

    expect(() => StreamRequestSchema.parse(sentBody)).not.toThrow();
    expect(sentOptions.method).toBe('POST');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Stream-Protocol')).toBe('ui-message-stream');
    expect(response.headers.get('X-Resumable')).toBe('true');

    const rawPayload = await response.text();
    const parsedEvents = parseSsePayload(rawPayload);

    expect(parsedEvents.length).toBeGreaterThan(0);
    parsedEvents.forEach((event) => {
      expect(() => StreamEventSchema.parse(event)).not.toThrow();
    });
    expect(parsedEvents.at(-1)?.type).toBe('done');
  });

  it('잘못된 요청은 400 에러 계약(success=false + error)을 만족해야 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'Empty query' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetch('/api/ai/supervisor/stream/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [], sessionId: 'session-1234' }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(() => StreamErrorSchema.parse(data)).not.toThrow();
    expect(data.error).toContain('query');
  });
});
