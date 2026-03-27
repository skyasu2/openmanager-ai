/**
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChatSessionState } from './useChatSessionState';

describe('useChatSessionState', () => {
  it('0개 메시지일 때 초기 상태를 반환한다', () => {
    const { result } = renderHook(() => useChatSessionState(0));

    expect(result.current.count).toBe(0);
    expect(result.current.remaining).toBe(50);
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isLimitReached).toBe(false);
  });

  it('경고 임계값(40) 미만이면 isWarning이 false', () => {
    const { result } = renderHook(() => useChatSessionState(39));

    expect(result.current.count).toBe(39);
    expect(result.current.remaining).toBe(11);
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isLimitReached).toBe(false);
  });

  it('경고 임계값(40) 이상이면 isWarning이 true', () => {
    const { result } = renderHook(() => useChatSessionState(40));

    expect(result.current.count).toBe(40);
    expect(result.current.remaining).toBe(10);
    expect(result.current.isWarning).toBe(true);
    expect(result.current.isLimitReached).toBe(false);
  });

  it('메시지 제한(50)에 도달하면 isLimitReached가 true', () => {
    const { result } = renderHook(() => useChatSessionState(50));

    expect(result.current.count).toBe(50);
    expect(result.current.remaining).toBe(0);
    expect(result.current.isWarning).toBe(true);
    expect(result.current.isLimitReached).toBe(true);
  });

  it('메시지 제한 초과 시에도 isLimitReached가 true', () => {
    const { result } = renderHook(() => useChatSessionState(55));

    expect(result.current.count).toBe(55);
    expect(result.current.remaining).toBe(-5);
    expect(result.current.isWarning).toBe(true);
    expect(result.current.isLimitReached).toBe(true);
  });

  it('disableSessionLimit이 true이면 무제한 상태를 반환한다', () => {
    const { result } = renderHook(() => useChatSessionState(100, true));

    expect(result.current.count).toBe(0);
    expect(result.current.remaining).toBe(Infinity);
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isLimitReached).toBe(false);
  });

  it('messageCount 변경 시 상태가 업데이트된다', () => {
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) => useChatSessionState(count),
      { initialProps: { count: 10 } }
    );

    expect(result.current.count).toBe(10);
    expect(result.current.remaining).toBe(40);

    rerender({ count: 45 });

    expect(result.current.count).toBe(45);
    expect(result.current.remaining).toBe(5);
    expect(result.current.isWarning).toBe(true);
  });
});
