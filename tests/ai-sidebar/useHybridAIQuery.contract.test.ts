/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const sendMessage = vi.fn();
  const setMessages = vi.fn();
  const stopChat = vi.fn();
  const asyncSendQuery = vi.fn();
  const asyncCancel = vi.fn();
  const asyncReset = vi.fn();
  const classifyQuery = vi.fn();
  const generateClarification = vi.fn();
  const analyzeQueryComplexity = vi.fn();
  const shouldForceJobQueue = vi.fn();
  const defaultChatTransport = vi.fn(function MockDefaultChatTransport(
    this: { config?: unknown },
    options: unknown
  ) {
    this.config = options;
  });

  return {
    sendMessage,
    setMessages,
    stopChat,
    asyncSendQuery,
    asyncCancel,
    asyncReset,
    classifyQuery,
    generateClarification,
    analyzeQueryComplexity,
    shouldForceJobQueue,
    defaultChatTransport,
    useChat: vi.fn(() => ({
      messages: [],
      sendMessage,
      status: 'ready',
      setMessages,
      stop: stopChat,
    })),
  };
});

vi.mock('@ai-sdk/react', () => ({
  useChat: mocks.useChat,
}));

vi.mock('ai', () => ({
  DefaultChatTransport: mocks.defaultChatTransport,
}));

vi.mock('@/lib/ai/query-classifier', () => ({
  classifyQuery: mocks.classifyQuery,
}));

vi.mock('@/lib/ai/clarification-generator', () => ({
  generateClarification: mocks.generateClarification,
  applyClarification: vi.fn((option: { query: string }) => option.query),
  applyCustomClarification: vi.fn(
    (original: string, custom: string) => `${original} ${custom}`
  ),
}));

vi.mock('@/lib/ai/utils/query-complexity', () => ({
  analyzeQueryComplexity: mocks.analyzeQueryComplexity,
  shouldForceJobQueue: mocks.shouldForceJobQueue,
}));

vi.mock('@/hooks/ai/useAsyncAIQuery', () => ({
  useAsyncAIQuery: vi.fn(() => ({
    sendQuery: mocks.asyncSendQuery,
    cancel: mocks.asyncCancel,
    reset: mocks.asyncReset,
    isLoading: false,
    progressPercent: 0,
    progressMessage: '',
    jobId: null,
  })),
}));

import { useHybridAIQuery } from '@/hooks/ai/useHybridAIQuery';

describe('useHybridAIQuery Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.sendMessage.mockResolvedValue(undefined);
    mocks.asyncSendQuery.mockResolvedValue({ jobId: 'job-contract-1' });

    mocks.classifyQuery.mockResolvedValue({
      intent: 'general',
      complexity: 'simple',
      confidence: 92,
    });

    mocks.generateClarification.mockReturnValue(null);

    mocks.analyzeQueryComplexity.mockReturnValue({
      level: 'simple',
      score: 10,
      factors: [],
    });

    mocks.shouldForceJobQueue.mockReturnValue({ force: false });
  });

  it('기본 스트리밍 엔드포인트 계약(/api/ai/supervisor/stream/v2)을 사용한다', () => {
    renderHook(() => useHybridAIQuery());

    expect(mocks.defaultChatTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        api: '/api/ai/supervisor/stream/v2',
      })
    );

    const transportOptions = mocks.defaultChatTransport.mock.calls[0]?.[0] as {
      prepareReconnectToStreamRequest: (args: { id: string }) => {
        api: string;
      };
    };

    expect(
      transportOptions.prepareReconnectToStreamRequest({ id: 'session-abc' })
    ).toEqual({
      api: '/api/ai/supervisor/stream/v2?sessionId=session-abc',
    });
  });

  it('간단 쿼리는 streaming 모드로 전송하고 요청 payload 계약을 지킨다', async () => {
    const { result } = renderHook(() => useHybridAIQuery());

    await act(async () => {
      await result.current.sendQuery('서버 상태 요약해줘');
    });

    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        text: '서버 상태 요약해줘',
      });
    });

    expect(result.current.state.mode).toBe('streaming');
    expect(result.current.state.warmingUp).toBe(true);
    expect(result.current.state.estimatedWaitSeconds).toBe(60);
    expect(mocks.asyncSendQuery).not.toHaveBeenCalled();
  });

  it('복잡 쿼리는 job-queue 모드로 라우팅되어 스트림 호출을 하지 않는다', async () => {
    mocks.analyzeQueryComplexity.mockReturnValue({
      level: 'very_complex',
      score: 98,
      factors: ['multi_step_analysis'],
    });
    mocks.shouldForceJobQueue.mockReturnValue({
      force: true,
      matchedKeyword: '분석',
    });

    const { result } = renderHook(() => useHybridAIQuery());

    await act(async () => {
      await result.current.sendQuery(
        '복잡한 장애 원인 분석과 재발 방지안 작성해줘'
      );
    });

    await waitFor(() => {
      expect(mocks.asyncSendQuery).toHaveBeenCalledWith(
        '복잡한 장애 원인 분석과 재발 방지안 작성해줘'
      );
    });

    expect(result.current.state.mode).toBe('job-queue');
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});
