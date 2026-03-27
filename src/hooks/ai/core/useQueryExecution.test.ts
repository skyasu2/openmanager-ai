/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QueryExecutionDeps } from './useQueryExecution';
import { useQueryExecution } from './useQueryExecution';

describe('useQueryExecution', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function createDeps(): QueryExecutionDeps {
    return {
      complexityThreshold: 999,
      asyncQuery: {
        sendQuery: vi.fn(async () => ({ jobId: 'job-1' })),
      },
      sendMessage: vi.fn(),
      onBeforeStreamingSend: vi.fn(),
      getMessages: () => [] as UIMessage[],
      setMessages: vi.fn(),
      setState: vi.fn(),
      chatStatus: 'ready',
      refs: {
        errorHandled: { current: false },
        currentQuery: { current: null },
        pendingQuery: { current: null },
        pendingAttachments: { current: null },
      },
    };
  }

  it('streaming query 시작 전에 trace lifecycle hook을 호출한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('서버 상태 알려줘');
    });

    await Promise.resolve();

    expect(deps.onBeforeStreamingSend).toHaveBeenCalledWith(false);
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '서버 상태 알려줘',
    });
  });

  it('retry streaming query도 trace lifecycle hook에 retry 플래그를 전달한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('다시 시도', undefined, true);
    });

    await Promise.resolve();

    expect(deps.onBeforeStreamingSend).toHaveBeenCalledWith(true);
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '다시 시도',
    });
  });
});
