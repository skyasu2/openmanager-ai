/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HybridQueryState } from '../types/hybrid-query.types';
import type { QueryExecutionDeps } from './useQueryExecution';
import { useQueryExecution } from './useQueryExecution';

describe('useQueryExecution', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const createBaseState = (): HybridQueryState => ({
    mode: 'streaming',
    complexity: null,
    progress: null,
    jobId: null,
    isLoading: false,
    error: null,
    errorDetails: null,
    clarification: null,
    warning: null,
    processingTime: 0,
    warmingUp: false,
    estimatedWaitSeconds: 0,
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.useRealTimers();
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
        rateLimitBlock: { current: null },
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

  it('alert prefill query는 기본 임계값 19에서도 streaming으로 유지한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery(
        'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.'
      );
    });

    await Promise.resolve();

    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: 'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.',
    });
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();
  });

  it('off-domain query면 best-effort disclaimer warning을 주입한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('오늘 서울 날씨 알려줘');
    });

    await Promise.resolve();
    await Promise.resolve();

    const updaterCalls = deps.setState.mock.calls
      .map(([updater]) => updater)
      .filter(
        (updater): updater is (prev: HybridQueryState) => HybridQueryState =>
          typeof updater === 'function'
      );

    const disclaimerUpdater = updaterCalls.find((updater) => {
      const next = updater({
        mode: 'streaming',
        complexity: null,
        progress: null,
        jobId: null,
        isLoading: false,
        error: null,
        errorDetails: null,
        clarification: null,
        warning: null,
        processingTime: 0,
        warmingUp: false,
        estimatedWaitSeconds: 0,
      });

      return next.warning?.includes('서버 운영·모니터링 중심 AI');
    });

    expect(disclaimerUpdater).toBeDefined();
  });

  it('thinking mode면 streaming 후보 쿼리도 job-queue로 더 적극적으로 보낸다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
      analysisMode: 'thinking' as const,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery(
        'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.'
      );
    });

    await Promise.resolve();

    expect(deps.asyncQuery.sendQuery).toHaveBeenCalledWith(
      'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.',
      { analysisMode: 'thinking' }
    );
  });

  it('active Retry-After cooldown이면 sendQuery를 fail-fast로 차단한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    process.env.NODE_ENV = 'production';
    const deps = createDeps();
    deps.refs.rateLimitBlock.current = {
      details: {
        kind: 'rate-limit',
        message: '요청이 너무 많습니다. 5초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 5,
        remaining: 0,
      },
      untilMs: Date.now() + 5_000,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    await act(async () => {
      await result.current.sendQuery('서버 상태 알려줘');
    });

    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();

    const updater = deps.setState.mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe('function');

    const nextState = (updater as (prev: HybridQueryState) => HybridQueryState)(
      createBaseState()
    );
    expect(nextState.error).toBe(
      '요청이 너무 많습니다. 5초 후 다시 시도해주세요.'
    );
    expect(nextState.errorDetails).toMatchObject({
      kind: 'rate-limit',
      scope: 'minute',
      retryAfterSeconds: 5,
    });
  });

  it('만료된 Retry-After cooldown은 자동 해제하고 streaming 전송을 진행한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    process.env.NODE_ENV = 'production';
    const deps = createDeps();
    deps.refs.rateLimitBlock.current = {
      details: {
        kind: 'rate-limit',
        message: '요청이 너무 많습니다. 1초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 1,
        remaining: 0,
      },
      untilMs: Date.now() - 1_000,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('서버 상태 알려줘');
    });

    await Promise.resolve();

    expect(deps.refs.rateLimitBlock.current).toBeNull();
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '서버 상태 알려줘',
    });
  });
});
