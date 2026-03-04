/**
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatFeedback } from './useChatFeedback';

vi.mock('@/lib/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('useChatFeedback', () => {
  const sessionIdRef = { current: 'session-123' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('positive 피드백을 성공적으로 전송한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));
    const success = await result.current.handleFeedback('msg-1', 'positive');

    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/feedback',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"positive"'),
      })
    );
  });

  it('negative 피드백을 전송한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));
    const success = await result.current.handleFeedback('msg-2', 'negative');

    expect(success).toBe(true);
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.type).toBe('negative');
    expect(body.sessionId).toBe('session-123');
    expect(body.messageId).toBe('msg-2');
  });

  it('API 오류 시 false를 반환한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));
    const success = await result.current.handleFeedback('msg-3', 'positive');

    expect(success).toBe(false);
  });

  it('네트워크 오류 시 false를 반환한다', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));
    const success = await result.current.handleFeedback('msg-4', 'negative');

    expect(success).toBe(false);
  });

  it('traceId가 있으면 body에 포함된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));
    await result.current.handleFeedback('msg-5', 'positive', 'trace-abc');

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.traceId).toBe('trace-abc');
  });

  it('sessionIdRef의 최신 값을 사용한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useChatFeedback(sessionIdRef));

    // 세션 ID 변경
    sessionIdRef.current = 'session-456';
    await result.current.handleFeedback('msg-6', 'positive');

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.sessionId).toBe('session-456');
  });
});
