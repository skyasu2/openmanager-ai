/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useChatSession } from './useChatSession';

describe('useChatSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('초기 세션 ID를 자동 생성한다', () => {
    const { result } = renderHook(() => useChatSession());

    expect(result.current.sessionId).toMatch(/^session-/);
    expect(result.current.sessionIdRef.current).toBe(result.current.sessionId);
  });

  it('외부에서 전달한 initialSessionId를 사용한다', () => {
    const { result } = renderHook(() => useChatSession('my-session'));

    expect(result.current.sessionId).toBe('my-session');
  });

  it('refreshSessionId로 새 세션을 생성한다', () => {
    const { result } = renderHook(() => useChatSession());
    const originalId = result.current.sessionId;

    act(() => {
      result.current.refreshSessionId();
    });

    expect(result.current.sessionId).not.toBe(originalId);
    expect(result.current.sessionId).toMatch(/^session-/);
    expect(result.current.sessionIdRef.current).toBe(result.current.sessionId);
  });

  it('setSessionId로 특정 세션 ID를 설정한다', () => {
    const { result } = renderHook(() => useChatSession());

    act(() => {
      result.current.setSessionId('custom-session-id');
    });

    expect(result.current.sessionId).toBe('custom-session-id');
    expect(result.current.sessionIdRef.current).toBe('custom-session-id');
  });

  it('세션 ID를 localStorage에 저장한다', () => {
    renderHook(() => useChatSession('persist-test'));

    const stored = JSON.parse(
      localStorage.getItem('openmanager-ai-session-id') || '{}'
    );
    expect(stored.sessionId).toBe('persist-test');
    expect(stored.savedAt).toBeGreaterThan(0);
  });

  it('refreshSessionId 후 localStorage가 새 세션으로 업데이트된다', () => {
    const { result } = renderHook(() => useChatSession());

    act(() => {
      result.current.refreshSessionId();
    });

    const stored = JSON.parse(
      localStorage.getItem('openmanager-ai-session-id') || '{}'
    );
    expect(stored.sessionId).toBe(result.current.sessionId);
  });
});
