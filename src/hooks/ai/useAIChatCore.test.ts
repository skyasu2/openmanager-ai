/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const handleFeedback = vi.fn(async () => true);
  const clearHistory = vi.fn();
  const addToQueue = vi.fn();
  const removeQueuedQuery = vi.fn();
  const popAndSendQueue = vi.fn();
  const clearQueue = vi.fn();
  const sendQuery = vi.fn();
  const executeQuery = vi.fn();
  const stop = vi.fn();
  const cancel = vi.fn();
  const reset = vi.fn();
  const clearError = vi.fn();
  const triggerAIWarmup = vi.fn(async () => undefined);
  const hybridSetMessagesSpy = vi.fn();
  const syncChatSnapshot = vi.fn();
  const generateIncidentReportArtifact = vi.fn();
  const generateMonitoringAnalysisArtifact = vi.fn();
  const generateServerSnapshotArtifact = vi.fn();

  let latestHybridOptions: Record<string, unknown> | null = null;
  let seedHybridMessages:
    | ((next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void)
    | null = null;

  return {
    handleFeedback,
    clearHistory,
    addToQueue,
    removeQueuedQuery,
    popAndSendQueue,
    clearQueue,
    sendQuery,
    executeQuery,
    stop,
    cancel,
    reset,
    clearError,
    triggerAIWarmup,
    hybridSetMessagesSpy,
    syncChatSnapshot,
    generateIncidentReportArtifact,
    generateMonitoringAnalysisArtifact,
    generateServerSnapshotArtifact,
    getLatestHybridOptions: () => latestHybridOptions,
    setLatestHybridOptions: (options: Record<string, unknown>) => {
      latestHybridOptions = options;
    },
    setSeedHybridMessages: (
      setter: (next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void
    ) => {
      seedHybridMessages = setter;
    },
    getSeedHybridMessages: () => seedHybridMessages,
  };
});

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: (
    selector: (state: {
      webSearchEnabled: boolean;
      ragEnabled: boolean;
      messages: unknown[];
      sessionId: string;
      syncChatSnapshot: typeof mocks.syncChatSnapshot;
    }) => unknown
  ) =>
    selector({
      webSearchEnabled: false,
      ragEnabled: false,
      messages: [],
      sessionId: 'session-test',
      syncChatSnapshot: mocks.syncChatSnapshot,
    }),
}));

vi.mock('@/utils/ai-warmup', () => ({
  triggerAIWarmup: mocks.triggerAIWarmup,
}));

vi.mock('@/lib/ai/chat-artifacts/incident-report-artifact', () => ({
  generateIncidentReportArtifact: mocks.generateIncidentReportArtifact,
}));

vi.mock('@/lib/ai/chat-artifacts/monitoring-analysis-artifact', () => ({
  generateMonitoringAnalysisArtifact: mocks.generateMonitoringAnalysisArtifact,
}));

vi.mock('@/lib/ai/chat-artifacts/server-snapshot-artifact', () => ({
  generateServerSnapshotArtifact: mocks.generateServerSnapshotArtifact,
}));

vi.mock('./core/useChatFeedback', () => ({
  useChatFeedback: () => ({
    handleFeedback: mocks.handleFeedback,
  }),
}));

vi.mock('./core/useChatHistory', () => ({
  useChatHistory: () => ({
    clearHistory: mocks.clearHistory,
  }),
}));

vi.mock('./core/useChatQueue', () => ({
  useChatQueue: () => ({
    queuedQueries: [],
    addToQueue: mocks.addToQueue,
    removeQueuedQuery: mocks.removeQueuedQuery,
    popAndSendQueue: mocks.popAndSendQueue,
    clearQueue: mocks.clearQueue,
    sendQueryRef: { current: null },
  }),
}));

vi.mock('./core/useChatSession', () => ({
  useChatSession: () => ({
    sessionId: 'session-test',
    sessionIdRef: { current: 'session-test' },
    refreshSessionId: vi.fn(),
    setSessionId: vi.fn(),
  }),
}));

vi.mock('./core/useChatSessionState', () => ({
  useChatSessionState: () => ({
    count: 0,
    remaining: 50,
    isWarning: false,
    isLimitReached: false,
  }),
}));

vi.mock('@/hooks/ai/useHybridAIQuery', async () => {
  const React = await import('react');

  return {
    useHybridAIQuery: (options: Record<string, unknown> = {}) => {
      mocks.setLatestHybridOptions(options);
      const [messages, setMessagesState] = React.useState<UIMessage[]>([]);

      React.useEffect(() => {
        mocks.setSeedHybridMessages((next) => {
          setMessagesState((prev) =>
            typeof next === 'function' ? next(prev) : next
          );
        });
      }, []);

      const setMessages = (
        next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
      ) => {
        mocks.hybridSetMessagesSpy(next);
        setMessagesState((prev) =>
          typeof next === 'function' ? next(prev) : next
        );
      };

      return {
        sendQuery: mocks.sendQuery,
        executeQuery: mocks.executeQuery,
        messages,
        setMessages,
        state: {
          progress: null,
          jobId: null,
          error: null,
          clarification: null,
          warmingUp: false,
          estimatedWaitSeconds: 0,
        },
        isLoading: false,
        stop: mocks.stop,
        cancel: mocks.cancel,
        reset: mocks.reset,
        clearError: mocks.clearError,
        currentMode: 'streaming' as const,
        selectClarification: vi.fn(),
        submitCustomClarification: vi.fn(),
        skipClarification: vi.fn(),
        dismissClarification: vi.fn(),
      };
    },
  };
});

import { useAIChatCore } from './useAIChatCore';

describe('useAIChatCore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('syncs enhanced chat snapshot into sidebar store when messages are present', async () => {
    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'CPU 상태 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '응답 본문' }],
          metadata: {
            traceId: 'trace-sync-1',
            toolsCalled: ['getServerMetrics'],
          },
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(mocks.syncChatSnapshot).toHaveBeenCalledWith(
      result.current.messages,
      'session-test'
    );
  });

  it('stale onData callback also injects traceId into the latest assistant message', async () => {
    const traceId = '1234567890abcdef1234567890abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'CPU 상태 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '확인 중입니다.' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    act(() => {
      initialOnData?.({
        type: 'data-done',
        data: {
          metadata: {
            traceId,
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.messages[1]?.metadata?.traceId).toBe(traceId);
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBe(traceId);
  });

  it('flushes pending stream tool results and response metadata after assistant message arrives', async () => {
    const traceId = 'abcdef1234567890abcdef1234567890';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 82,
              minuteOfDay: 820,
              timeLabel: '13:40 KST',
            },
            dataSource: {
              scopeName: 'openmanager-ai-otel-pipeline',
              scopeVersion: '1.0.0',
              catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
              hour: 13,
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '서버 상태 요약',
          responseDetails: '상세 분석',
          responseShouldCollapse: true,
          metadata: {
            traceId,
          },
        },
      });
    });

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      const assistant = result.current.messages[1];
      expect(assistant?.metadata?.traceId).toBe(traceId);
      expect(assistant?.metadata?.assistantResponseView).toBeDefined();
      expect(
        assistant?.thinkingSteps?.some(
          (step) => step.step === 'getServerMetrics'
        )
      ).toBe(true);
    });

    const assistant = result.current.messages[1];
    expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
      '서버 상태 요약'
    );
  });

  it('keeps metadata pending until the newest assistant message arrives when the latest message is user', async () => {
    const traceId = 'trace-latest-assistant-abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '첫 질문' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '이전 응답' }],
        },
        {
          id: 'user-2',
          role: 'user',
          parts: [{ type: 'text', text: '추가 질문' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3);
    });

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 108,
              minuteOfDay: 1080,
              timeLabel: '18:00 KST',
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '최신 응답 요약',
          metadata: {
            traceId,
          },
        },
      });
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBeUndefined();

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '첫 질문' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '이전 응답' }],
        },
        {
          id: 'user-2',
          role: 'user',
          parts: [{ type: 'text', text: '추가 질문' }],
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          parts: [{ type: 'text', text: '최신 응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages[3]?.metadata?.traceId).toBe(traceId);
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBeUndefined();
    expect(
      result.current.messages[3]?.metadata?.assistantResponseView?.summary
    ).toBe('최신 응답 요약');
    expect(
      result.current.messages[3]?.thinkingSteps?.some(
        (step) => step.step === 'getServerMetrics'
      )
    ).toBe(true);
  });

  it('preserves deferred stream parity metadata even if the assistant message is overwritten later', async () => {
    const traceId = 'trace-race-1234567890abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '중간 응답' }],
        },
      ]);
    });

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 85,
              minuteOfDay: 850,
              timeLabel: '14:10 KST',
            },
            dataSource: {
              scopeName: 'openmanager-ai-otel-pipeline',
              scopeVersion: '1.0.0',
              catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
              hour: 14,
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '메모리 상태 요약',
          responseDetails: '상세 분석',
          responseShouldCollapse: true,
          metadata: {
            traceId,
          },
        },
      });
    });

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '최종 응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      const assistant = result.current.messages[1];
      expect(assistant?.metadata?.traceId).toBe(traceId);
      expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
        '서버 실시간 데이터 분석'
      );
      expect(
        assistant?.thinkingSteps?.some(
          (step) => step.step === 'getServerMetrics'
        )
      ).toBe(true);
      expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
        '메모리 상태 요약'
      );
    });
  });

  it('injects deterministic thinking visualizer messages for qa prompt without calling backend', async () => {
    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('/qa-thinking-visualizer');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    expect(mocks.sendQuery).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.role).toBe('user');
    expect(result.current.messages[1]?.role).toBe('assistant');
    expect(result.current.messages[1]?.thinkingSteps?.length).toBeGreaterThan(
      0
    );
    expect(
      result.current.messages[1]?.thinkingSteps?.some(
        (step) => step.step === 'analyzeIntent'
      )
    ).toBe(true);
  });

  it('turns explicit incident report requests into an artifact without calling chat backend', async () => {
    const slot = {
      slotIndex: 143,
      minuteOfDay: 1430,
      timeLabel: '23:50 KST',
    };
    mocks.generateIncidentReportArtifact.mockResolvedValue({
      kind: 'incident-report',
      generatedAt: '2026-05-02T00:00:00.000Z',
      report: {
        id: 'incident-chat-1',
        title: '스토리지 디스크 포화 경고',
        severity: 'critical',
        timestamp: new Date('2026-05-02T00:00:00.000Z'),
        affectedServers: ['storage-nfs-dc1-01'],
        description: 'NFS 디스크 사용률이 임계값을 초과했습니다.',
        status: 'active',
      },
    });

    const { result } = renderHook(() =>
      useAIChatCore({ queryAsOfDataSlot: slot })
    );

    await act(async () => {
      result.current.setInput('장애 보고서 작성해줘');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    await waitFor(() => {
      expect(
        result.current.messages[1]?.metadata?.incidentReportArtifact
      ).toBeDefined();
    });

    expect(mocks.sendQuery).not.toHaveBeenCalled();
    expect(mocks.generateIncidentReportArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '장애 보고서 작성해줘',
        queryAsOfDataSlot: slot,
        sessionId: 'session-test',
      })
    );
    expect(result.current.messages[0]?.role).toBe('user');
    expect(result.current.messages[1]?.content).toContain(
      '장애 보고서를 작성했습니다'
    );
    expect(result.current.messages[1]?.metadata?.artifactIntentReason).toBe(
      'incident_report_action_pattern'
    );
    expect(result.current.messages[1]?.metadata?.routeDecision).toMatchObject({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'incident-report',
      reasonCodes: ['incident_report_action_pattern'],
      decidedBy: 'frontend',
    });
    expect(
      result.current.messages[1]?.metadata?.incidentReportArtifact?.report.title
    ).toBe('스토리지 디스크 포화 경고');
  });

  it('marks artifact generation as loading and blocks duplicate artifact calls', async () => {
    let resolveArtifact: (
      value: Awaited<ReturnType<typeof mocks.generateIncidentReportArtifact>>
    ) => void = () => undefined;
    mocks.generateIncidentReportArtifact.mockReturnValue(
      new Promise((resolve) => {
        resolveArtifact = resolve;
      })
    );

    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('장애 보고서 작성해줘');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    expect(result.current.isLoading).toBe(true);
    expect(mocks.generateIncidentReportArtifact).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.setInput('장애 보고서 작성해줘');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    expect(mocks.generateIncidentReportArtifact).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('아티팩트 생성이 진행 중입니다');

    await act(async () => {
      resolveArtifact({
        kind: 'incident-report',
        generatedAt: '2026-05-02T00:00:00.000Z',
        report: {
          id: 'incident-chat-2',
          title: '중복 요청 방지 보고서',
          severity: 'warning',
          timestamp: new Date('2026-05-02T00:00:00.000Z'),
          affectedServers: ['api-was-dc1-01'],
          description: '중복 요청 방지 검증',
          status: 'active',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.messages[1]?.content).toContain(
      '장애 보고서를 작성했습니다'
    );
  });

  it('does not mark artifact generation as loading while LLM artifact intent classification is pending', async () => {
    let resolveClassifier: (response: Response) => void = () => undefined;
    const classifierPromise = new Promise<Response>((resolve) => {
      resolveClassifier = resolve;
    });
    const fetchMock = vi.fn(() => classifierPromise);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('보고서 뽑아줘');
    });

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = result.current.handleSendInput();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/artifact-intent',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: '보고서 뽑아줘' }),
        })
      );
    });

    expect(result.current.isLoading).toBe(false);
    expect(mocks.generateIncidentReportArtifact).not.toHaveBeenCalled();
    expect(mocks.generateMonitoringAnalysisArtifact).not.toHaveBeenCalled();

    await act(async () => {
      resolveClassifier({
        ok: true,
        json: async () => ({ kind: 'none' }),
      } as Response);
      await sendPromise;
    });

    expect(mocks.sendQuery).toHaveBeenCalledWith('보고서 뽑아줘', undefined);
  });

  it('aborts an in-flight artifact request when stop is invoked', async () => {
    let capturedSignal: AbortSignal | undefined;
    mocks.generateIncidentReportArtifact.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) => {
        capturedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }
    );

    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('장애 보고서 작성해줘');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    expect(result.current.isLoading).toBe(true);
    expect(capturedSignal).toBeDefined();

    await act(async () => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.messages[1]?.content).toContain(
      '장애 보고서 작성을 중단했습니다'
    );
  });

  it('turns explicit trend analysis requests into an artifact without calling chat backend', async () => {
    mocks.generateMonitoringAnalysisArtifact.mockResolvedValue({
      kind: 'monitoring-analysis',
      generatedAt: '2026-05-02T00:01:00.000Z',
      title: '전체 서버 이상감지/추세 분석',
      summary: '18개 서버 분석 완료, 주의 1대',
      serverCount: 18,
      riskSignalCount: 1,
      warningServers: 1,
      criticalServers: 0,
      analysis: {
        success: true,
        sourceMode: 'replay-json',
        queryAsOf: '2026-05-02T00:00:00.000Z',
        slot: {
          slotIndex: 143,
          hour: 23,
          slotInHour: 5,
          minuteOfDay: 1430,
          timeLabel: '23:50 KST',
          startTime: '2026-05-02T00:00:00.000Z',
          endTime: '2026-05-02T00:10:00.000Z',
        },
        summary: '18개 서버 분석 완료',
        servers: [],
        riskSignals: [],
        evidenceRefs: [],
        dataFreshness: {
          generatedAt: null,
          sourceUpdatedAt: null,
          stale: false,
        },
      },
    });

    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('최근 추세 기준으로 리스크 분석해줘');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    await waitFor(() => {
      expect(
        result.current.messages[1]?.metadata?.monitoringAnalysisArtifact
      ).toBeDefined();
    });

    expect(mocks.sendQuery).not.toHaveBeenCalled();
    expect(mocks.generateMonitoringAnalysisArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '최근 추세 기준으로 리스크 분석해줘',
        sessionId: 'session-test',
      })
    );
    expect(result.current.messages[1]?.content).toContain(
      '이상감지/추세 분석을 완료했습니다'
    );
    expect(result.current.messages[1]?.metadata?.artifactIntentReason).toBe(
      'monitoring_action_pattern'
    );
    expect(
      result.current.messages[1]?.metadata?.monitoringAnalysisArtifact
        ?.riskSignalCount
    ).toBe(1);
  });

  it('turns explicit server snapshot requests into an artifact without calling chat backend', async () => {
    const slot = {
      slotIndex: 42,
      minuteOfDay: 420,
      timeLabel: '07:00 KST',
    };
    mocks.generateServerSnapshotArtifact.mockResolvedValue({
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '현재 서버 상태 스냅샷',
      summary: '4대 서버 중 위험 1대, 주의 1대입니다.',
      source: 'otel-static',
      queryAsOfDataSlot: slot,
      slot,
      totals: {
        total: 4,
        online: 2,
        warning: 1,
        critical: 1,
        offline: 0,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
      topServers: [],
      alerts: [],
    });

    const { result } = renderHook(() =>
      useAIChatCore({ queryAsOfDataSlot: slot })
    );

    await act(async () => {
      result.current.setInput('서버 상태 스냅샷');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    await waitFor(() => {
      expect(
        result.current.messages[1]?.metadata?.serverSnapshotArtifact
      ).toBeDefined();
    });

    expect(mocks.sendQuery).not.toHaveBeenCalled();
    expect(mocks.generateServerSnapshotArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '서버 상태 스냅샷',
        queryAsOfDataSlot: slot,
        sessionId: 'session-test',
      })
    );
    expect(result.current.messages[1]?.content).toContain(
      '서버 상태 스냅샷을 생성했습니다'
    );
    expect(result.current.messages[1]?.metadata?.artifactIntentReason).toBe(
      'server_snapshot_implicit_artifact_keyword'
    );
    expect(result.current.messages[1]?.metadata?.routeDecision).toMatchObject({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'server-snapshot',
      reasonCodes: ['server_snapshot_implicit_artifact_keyword'],
      decidedBy: 'frontend',
      dataSlot: '07:00 KST',
    });
    expect(
      result.current.messages[1]?.metadata?.serverSnapshotArtifact?.totals.total
    ).toBe(4);
  });

  it('answers ambiguous artifact feature questions locally without API calls', async () => {
    const { result } = renderHook(() => useAIChatCore());

    await act(async () => {
      result.current.setInput('장애 보고는 어떻게 하면 돼?');
    });

    await act(async () => {
      result.current.handleSendInput();
    });

    expect(mocks.sendQuery).not.toHaveBeenCalled();
    expect(mocks.generateIncidentReportArtifact).not.toHaveBeenCalled();
    expect(mocks.generateMonitoringAnalysisArtifact).not.toHaveBeenCalled();
    expect(result.current.messages[1]?.content).toContain(
      '장애 보고서 작성 기능'
    );
    expect(result.current.messages[1]?.metadata?.artifactIntentReason).toBe(
      'incident_report_guidance_pattern'
    );
  });
});
