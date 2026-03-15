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

    const messages = buildSupervisorStreamMessages(request);

    expect(messages[0]).toEqual({
      role: 'system',
      content: createSystemPrompt('desktop'),
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

    const messages = buildSupervisorStreamMessages(request);
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
});
