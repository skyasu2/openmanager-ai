import { describe, expect, it } from 'vitest';
import { createSystemPrompt } from './supervisor-routing';
import {
  buildSupervisorStreamMessages,
  getLastUserQueryText,
} from './supervisor-stream-messages';

describe('getLastUserQueryText', () => {
  it('returns the last user message content', () => {
    expect(
      getLastUserQueryText([
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'final question' },
      ])
    ).toBe('final question');
  });

  it('returns empty string when no user message exists', () => {
    expect(
      getLastUserQueryText([{ role: 'assistant', content: 'answer only' }])
    ).toBe('');
  });
});

describe('buildSupervisorStreamMessages', () => {
  it('prepends system prompt and preserves non-final messages as plain text', () => {
    const request = {
      sessionId: 'session-1',
      deviceType: 'desktop' as const,
      messages: [
        { role: 'user' as const, content: 'first question' },
        { role: 'assistant' as const, content: 'assistant answer' },
        { role: 'user' as const, content: 'final question' },
      ],
    };

    const systemPrompt = createSystemPrompt('desktop');
    const messages = buildSupervisorStreamMessages(request, systemPrompt);

    expect(messages[0]).toEqual({
      role: 'system',
      content: systemPrompt,
    });
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'first question',
    });
    expect(messages[2]).toEqual({
      role: 'assistant',
      content: 'assistant answer',
    });
  });

  it('builds multimodal content only for the final user message', () => {
    const request = {
      sessionId: 'session-2',
      deviceType: 'mobile' as const,
      messages: [
        { role: 'user' as const, content: 'earlier question' },
        { role: 'user' as const, content: 'analyze this image' },
      ],
      images: [{ data: 'base64-image', mimeType: 'image/png' }],
      files: [{ data: 'base64-pdf', mimeType: 'application/pdf' }],
    };

    const messages = buildSupervisorStreamMessages(
      request,
      createSystemPrompt('mobile')
    );
    const finalContent = messages[2]?.content;

    expect(messages[1]).toEqual({
      role: 'user',
      content: 'earlier question',
    });
    expect(Array.isArray(finalContent)).toBe(true);
    expect(finalContent).toEqual([
      { type: 'text', text: 'analyze this image' },
      { type: 'image', image: 'base64-image', mimeType: 'image/png' },
      { type: 'file', data: 'base64-pdf', mimeType: 'application/pdf' },
    ]);
  });

  it('adds explicit prior assistant context for formatting-only rewrites', () => {
    const request = {
      sessionId: 'session-rewrite',
      messages: [
        { role: 'user' as const, content: 'CPU 상위 3개 서버 알려줘' },
        {
          role: 'assistant' as const,
          content:
            '1. api-was-dc1-01 CPU 71%\\n2. cache-redis-dc1-01 CPU 69%\\n3. cache-redis-dc1-03 CPU 45%',
        },
        {
          role: 'user' as const,
          content:
            '위 답변을 운영 보고서용 2문장으로 다시 작성해줘. 서버 ID와 수치는 보존해.',
        },
      ],
    };

    const messages = buildSupervisorStreamMessages(
      request,
      createSystemPrompt()
    );
    const finalContent = messages.at(-1)?.content;

    expect(typeof finalContent).toBe('string');
    expect(finalContent).toContain('[직전 assistant 답변]');
    expect(finalContent).toContain('api-was-dc1-01 CPU 71%');
    expect(finalContent).toContain('cache-redis-dc1-01 CPU 69%');
    expect(finalContent).toContain('cache-redis-dc1-03 CPU 45%');
    expect(finalContent).toContain('[사용자 재작성 요청]');
  });
});
