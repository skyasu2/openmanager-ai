/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractEntities } from '@/lib/ai/entity-extractor';
import type { HybridQueryState } from '../types/hybrid-query.types';
import type { QueryExecutionDeps } from './useQueryExecution';
import { useQueryExecution } from './useQueryExecution';

vi.mock('@/lib/ai/entity-extractor', () => ({
  extractEntities: vi.fn(async () => ({ confidence: 0 })),
}));

describe('useQueryExecution', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mockExtractEntities = vi.mocked(extractEntities);
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractEntities.mockResolvedValue({ confidence: 0 });
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
    const onRouteDecision = vi.fn();
    const deps = { ...createDeps(), onRouteDecision };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('서버 상태 알려줘');
    });

    await Promise.resolve();

    expect(deps.onBeforeStreamingSend).toHaveBeenCalledWith(false);
    expect(onRouteDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        decidedBy: 'frontend',
      })
    );
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '서버 상태 알려줘',
    });
  });

  it.each([
    {
      label: 'simple metric lookup',
      query: 'CPU 알려줘',
      expected: {
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        decidedBy: 'frontend',
      },
      expectedMode: 'streaming',
    },
    {
      label: 'forced job report request',
      query: '전체 서버 장애 원인 분석 보고서 만들어줘',
      expected: {
        intent: 'job',
        executionPath: 'job',
        complexity: 'very_complex',
        reasonCodes: ['force_job_queue_keyword'],
        decidedBy: 'frontend',
      },
      expectedMode: 'job-queue',
    },
  ])('pins current frontend stream/job route baseline for $label', async ({
    query,
    expected,
    expectedMode,
  }) => {
    process.env.NODE_ENV = 'production';
    const onRouteDecision = vi.fn();
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
      onRouteDecision,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery(query);
    });

    await Promise.resolve();

    expect(onRouteDecision).toHaveBeenCalledWith(
      expect.objectContaining(expected)
    );
    if (expectedMode === 'streaming') {
      expect(deps.sendMessage).toHaveBeenCalledWith({ text: query });
      expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();
    } else {
      expect(deps.asyncQuery.sendQuery).toHaveBeenCalledWith(query);
      expect(deps.sendMessage).not.toHaveBeenCalled();
    }
  });

  it('pins current attachment route baseline to streaming for the future vision escalation comparison', async () => {
    process.env.NODE_ENV = 'production';
    const onRouteDecision = vi.fn();
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
      onRouteDecision,
    };
    const attachment = {
      id: 'file-1',
      name: 'screen.png',
      mimeType: 'image/png',
      size: 128,
      data: 'data:image/png;base64,abc',
      type: 'image' as const,
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('이 스크린샷 분석해줘', [attachment]);
    });

    await Promise.resolve();

    expect(onRouteDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'chat',
        executionPath: 'stream',
        reasonCodes: ['attachment_streaming'],
        decidedBy: 'frontend',
      })
    );
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '이 스크린샷 분석해줘',
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,abc',
          filename: 'screen.png',
        },
      ],
    });
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();
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

  it('off-domain live fact query는 LLM 전송 없이 deterministic guard 응답을 남긴다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('비트코인 지금 가격 알려줘');
    });

    await Promise.resolve();

    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();

    const messagesUpdater = deps.setMessages.mock.calls.at(-1)?.[0];
    expect(typeof messagesUpdater).toBe('function');

    const nextMessages = (
      messagesUpdater as (prev: UIMessage[]) => UIMessage[]
    )([]);
    expect(nextMessages).toHaveLength(2);
    expect(nextMessages[0]?.role).toBe('user');
    expect(nextMessages[1]?.role).toBe('assistant');
    expect(nextMessages[1]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('실시간'),
        }),
      ])
    );

    const stateUpdater = deps.setState.mock.calls.at(-1)?.[0];
    expect(typeof stateUpdater).toBe('function');
    const nextState = (
      stateUpdater as (prev: HybridQueryState) => HybridQueryState
    )(createBaseState());
    expect(nextState.isLoading).toBe(false);
    expect(nextState.warning).toContain('서버 운영');
  });

  it('sendQuery off-domain query는 entity extraction 호출 전에 guard로 종료한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    await act(async () => {
      await result.current.sendQuery('비트코인 지금 가격 알려줘');
    });
    await Promise.resolve();

    expect(mockExtractEntities).not.toHaveBeenCalled();
    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();
  });

  it('general coding query는 LLM 전송 없이 deterministic guard 응답을 남긴다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    act(() => {
      result.current.executeQuery('파이썬 피보나치 코드 짜줘');
    });

    await Promise.resolve();

    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();

    const messagesUpdater = deps.setMessages.mock.calls.at(-1)?.[0];
    expect(typeof messagesUpdater).toBe('function');

    const nextMessages = (
      messagesUpdater as (prev: UIMessage[]) => UIMessage[]
    )([]);
    expect(nextMessages).toHaveLength(2);
    expect(nextMessages[0]?.role).toBe('user');
    expect(nextMessages[1]?.role).toBe('assistant');
    expect(nextMessages[1]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('일반 알고리즘'),
        }),
      ])
    );

    const stateUpdater = deps.setState.mock.calls.at(-1)?.[0];
    expect(typeof stateUpdater).toBe('function');
    const nextState = (
      stateUpdater as (prev: HybridQueryState) => HybridQueryState
    )(createBaseState());
    expect(nextState.isLoading).toBe(false);
    expect(nextState.warning).toContain('서버 운영');
  });

  it('sendQuery general coding query는 entity extraction 호출 전에 guard로 종료한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    await act(async () => {
      await result.current.sendQuery('leetcode two sum 풀어줘');
    });
    await Promise.resolve();

    expect(mockExtractEntities).not.toHaveBeenCalled();
    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.asyncQuery.sendQuery).not.toHaveBeenCalled();
  });

  it('clarification 후보 운영 질의에서 신뢰도 높은 entity가 있으면 바로 실행한다', async () => {
    process.env.NODE_ENV = 'production';
    mockExtractEntities.mockResolvedValue({
      server: 'api-was-dc1-01',
      confidence: 92,
    });
    const deps = createDeps();

    const { result } = renderHook(() => useQueryExecution(deps));

    await act(async () => {
      await result.current.sendQuery('서버 상태 확인');
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockExtractEntities).toHaveBeenCalledWith('서버 상태 확인');
    const clarificationStates = deps.setState.mock.calls
      .map(([updater]) =>
        typeof updater === 'function' ? updater(createBaseState()) : updater
      )
      .map((state) => state.clarification)
      .filter(Boolean);

    expect(clarificationStates).toHaveLength(0);
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

  it('job-queue 요청에 RAG/Web/analysisMode 옵션을 함께 전달한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
      analysisMode: 'thinking' as const,
      ragEnabled: true,
      webSearchEnabled: true,
    } as QueryExecutionDeps & {
      ragEnabled: boolean;
      webSearchEnabled: boolean;
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
      {
        analysisMode: 'thinking',
        enableRAG: true,
        enableWebSearch: true,
      }
    );
  });

  it('job-queue Auto source mode에서는 RAG/Web 옵션을 생략한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = {
      ...createDeps(),
      complexityThreshold: 19,
      analysisMode: 'thinking' as const,
      ragEnabled: false,
      webSearchEnabled: false,
    } as QueryExecutionDeps & {
      ragEnabled: boolean;
      webSearchEnabled: boolean;
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
      {
        analysisMode: 'thinking',
      }
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

  it('직전 답변 재작성 요청은 clarification 없이 streaming으로 전송한다', async () => {
    process.env.NODE_ENV = 'production';
    const deps = {
      ...createDeps(),
      getMessages: () =>
        [
          {
            id: 'assistant-prior',
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: '1. api-was-dc1-01 CPU 71%\\n2. cache-redis-dc1-01 CPU 69%\\n3. cache-redis-dc1-03 CPU 45%',
              },
            ],
          },
        ] as UIMessage[],
    };

    const { result } = renderHook(() => useQueryExecution(deps));

    await act(async () => {
      await result.current.sendQuery(
        '위 답변을 운영 보고서용 2문장으로 다시 작성해줘. 서버 ID와 수치는 보존해.'
      );
    });
    await Promise.resolve();

    expect(deps.setState).not.toHaveBeenCalledWith(
      expect.objectContaining({
        clarification: expect.objectContaining({
          reason: expect.stringContaining('특정 서버'),
        }),
      })
    );
    expect(deps.sendMessage).toHaveBeenCalledWith({
      text: '위 답변을 운영 보고서용 2문장으로 다시 작성해줘. 서버 ID와 수치는 보존해.',
    });
  });

  it('job queue 요청에 dashboard data slot을 전달한다', async () => {
    process.env.NODE_ENV = 'production';
    const onRouteDecision = vi.fn();
    const queryAsOfDataSlot = {
      slotIndex: 131,
      minuteOfDay: 1310,
      timeLabel: '21:50 KST',
    };
    const deps = {
      ...createDeps(),
      complexityThreshold: -1,
      analysisMode: 'thinking' as const,
      queryAsOfDataSlot,
      onRouteDecision,
    };

    const { result } = renderHook(() => useQueryExecution(deps));
    const query = '현재 위험/경고 서버 근본 원인 분석 보고서를 만들어줘';

    act(() => {
      result.current.executeQuery(query);
    });

    await waitFor(() => {
      expect(deps.asyncQuery.sendQuery).toHaveBeenCalledWith(
        query,
        expect.objectContaining({
          analysisMode: 'thinking',
          queryAsOfDataSlot,
        })
      );
    });
    expect(onRouteDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'job',
        executionPath: 'job',
        decidedBy: 'frontend',
        dataSlot: '21:50 KST',
      })
    );
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
