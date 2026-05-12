import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (vi.hoisted) ---

const mocks = vi.hoisted(() => ({
  extractStreamError: vi.fn(() => null),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  calculateBackoff: vi.fn(() => 100),
}));

vi.mock('@/lib/ai/constants/stream-errors', () => ({
  extractStreamError: mocks.extractStreamError,
}));

vi.mock('@/lib/logging', () => ({
  logger: mocks.logger,
}));

vi.mock('@/lib/utils/retry', () => ({
  calculateBackoff: mocks.calculateBackoff,
}));

// --- EventSource mock ---

class MockEventSource {
  static CLOSED = 2;
  url: string;
  readyState = 0;
  listeners = new Map<string, EventListener[]>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: EventListener) {
    const existing = this.listeners.get(type) || [];
    existing.push(handler);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, handler: EventListener) {
    const existing = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      existing.filter((h) => h !== handler)
    );
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  /** Helper to simulate server-sent events in tests */
  emit(type: string, data?: string) {
    const event = data ? { type, data } : { type };
    for (const handler of this.listeners.get(type) || []) {
      handler(event as unknown as Event);
    }
  }
}

globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

// --- SUT ---

import {
  closeTrackedEventSource,
  connectAsyncQuerySSE,
  type TrackedSSEListener,
} from './asyncQuerySSE';

// --- Helpers ---

function createRef<T>(value: T) {
  return { current: value };
}

function buildDefaultParams(overrides: Record<string, unknown> = {}) {
  const eventSourceRef = createRef<EventSource | null>(null);
  const listenersRef = createRef<TrackedSSEListener[]>([]);
  const timeoutRef = createRef<NodeJS.Timeout | null>(null);

  return {
    jobId: 'test-job-123',
    timeout: 30_000,
    eventSourceRef,
    listenersRef,
    timeoutRef,
    getCurrentProgress: vi.fn(() => 50),
    onConnected: vi.fn(),
    onProgress: vi.fn(),
    onResult: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

/** Get the underlying MockEventSource from an EventSource ref */
function getMock(ref: { current: EventSource | null }): MockEventSource {
  return ref.current as unknown as MockEventSource;
}

// --- Tests ---

describe('closeTrackedEventSource', () => {
  it('removes all tracked listeners and closes EventSource', () => {
    const es = new MockEventSource('/test');
    const handler1: EventListener = vi.fn();
    const handler2: EventListener = vi.fn();

    es.addEventListener('progress', handler1);
    es.addEventListener('result', handler2);

    const eventSourceRef = createRef<EventSource | null>(
      es as unknown as EventSource
    );
    const listenersRef = createRef<TrackedSSEListener[]>([
      { eventType: 'progress', handler: handler1 },
      { eventType: 'result', handler: handler2 },
    ]);

    closeTrackedEventSource(eventSourceRef, listenersRef);

    expect(es.readyState).toBe(MockEventSource.CLOSED);
    expect(eventSourceRef.current).toBeNull();
    expect(listenersRef.current).toEqual([]);
    // Listeners should have been removed
    expect(es.listeners.get('progress')).toEqual([]);
    expect(es.listeners.get('result')).toEqual([]);
  });

  it('handles null eventSourceRef gracefully', () => {
    const eventSourceRef = createRef<EventSource | null>(null);
    const listenersRef = createRef<TrackedSSEListener[]>([
      { eventType: 'x', handler: vi.fn() },
    ]);

    // Should not throw
    expect(() =>
      closeTrackedEventSource(eventSourceRef, listenersRef)
    ).not.toThrow();

    // listenersRef stays untouched because early return
    expect(listenersRef.current).toHaveLength(1);
  });

  it('clears listenersRef array after closing', () => {
    const es = new MockEventSource('/test');
    const eventSourceRef = createRef<EventSource | null>(
      es as unknown as EventSource
    );
    const listenersRef = createRef<TrackedSSEListener[]>([
      { eventType: 'a', handler: vi.fn() },
      { eventType: 'b', handler: vi.fn() },
      { eventType: 'c', handler: vi.fn() },
    ]);

    closeTrackedEventSource(eventSourceRef, listenersRef);

    expect(listenersRef.current).toEqual([]);
  });
});

describe('connectAsyncQuerySSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('creates EventSource with correct URL', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    expect(es).not.toBeNull();
    expect(es.url).toBe('/api/ai/jobs/test-job-123/stream');
  });

  it('calls onConnected when "connected" event fires', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit('connected');

    expect(params.onConnected).toHaveBeenCalledOnce();
  });

  it('calls onProgress with parsed data when "progress" event fires', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const progressData = {
      stage: 'analyzing',
      progress: 40,
      message: 'Processing...',
    };
    es.emit('progress', JSON.stringify(progressData));

    expect(params.onProgress).toHaveBeenCalledWith(progressData);
  });

  it('preserves job queue agent path metadata on progress events', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const progressData = {
      stage: 'analyst',
      progress: 62,
      message: '심층 분석으로 전달 중...',
      agent: 'analyst',
      handoffFrom: 'supervisor',
      handoffTo: 'analyst',
      executionPath: ['supervisor', 'analyst', 'reporter'],
      handoffCount: 2,
      stageLabel: '심층 분석',
      stageDetail: '분석 조율 → 심층 분석 → 보고서 생성',
    };
    es.emit('progress', JSON.stringify(progressData));

    expect(params.onProgress).toHaveBeenCalledWith(progressData);
  });

  it('calls onResult with parsed data when "result" event fires', () => {
    const params = buildDefaultParams();
    mocks.extractStreamError.mockReturnValue(null);

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const resultData = {
      response: 'Analysis complete',
      targetAgent: 'analyst',
      toolsCalled: ['getServerMetrics', 'detectAnomalies'],
      toolResults: [],
      ragSources: [],
      processingTimeMs: 1200,
      metadata: {
        traceId: 'trace-abc',
        resolvedMode: 'multi',
        modeSelectionSource: 'auto_complexity',
        latencyTier: 'slow',
        provider: 'mistral',
        modelId: 'mistral-large-latest',
        usedFallback: true,
        fallbackReason: 'empty_response',
        ttfbMs: 1520,
        routeDecision: {
          intent: 'job',
          executionPath: 'job',
          mode: 'multi',
          complexity: 'complex',
          reasonCodes: ['job_queue_api'],
          ruleVersion: '2026-05-03-v1',
          decidedBy: 'cloud-run',
        },
        assistantPlan: {
          kind: 'chat',
          planVersion: '2026-05-03-v1',
          routeDecision: {
            intent: 'job',
            executionPath: 'job',
            mode: 'multi',
            complexity: 'complex',
            reasonCodes: ['job_queue_api'],
            ruleVersion: '2026-05-03-v1',
            decidedBy: 'cloud-run',
          },
          executionPath: 'job',
          stream: false,
          job: true,
          reasonCodes: ['job_queue_api'],
          decidedBy: 'cloud-run',
        },
        assistantResult: {
          kind: 'chat',
          resultVersion: '2026-05-03-v1',
          routeDecision: {
            intent: 'job',
            executionPath: 'job',
            mode: 'multi',
            complexity: 'complex',
            reasonCodes: ['job_queue_api'],
            ruleVersion: '2026-05-03-v1',
            decidedBy: 'cloud-run',
          },
          status: 'completed',
        },
        semanticQueryTrace: {
          originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
          selectedDomain: 'openmanager-monitoring',
          selectedCapability: 'monitoring.metric_peak',
          selectedEvidenceProvider: 'monitoring-peak-metric',
          evidenceAvailable: true,
          clarificationRequired: false,
          reasonCodes: ['semantic_frame_evidence_validated'],
        },
        providerAttempts: [
          {
            provider: 'cerebras',
            modelId: 'llama3.1-8b',
            attempt: 1,
            durationMs: 820,
            error: 'raw tool-call JSON',
          },
          {
            provider: 'mistral',
            modelId: 'mistral-large-latest',
            attempt: 1,
            durationMs: 1540,
          },
        ],
        retrieval: {
          retrievalEnabled: true,
          retrievalUsed: false,
          retrievalMode: 'lite',
          suppressedReason: 'no_results',
          evidenceCount: 0,
          webUsed: false,
        },
        handoffs: [{ from: 'supervisor', to: 'analyst', reason: 'deep dive' }],
        toolResultSummaries: [
          {
            toolName: 'detectAnomalies',
            label: '이상 탐지',
            summary: '1개 이상 징후를 감지했습니다.',
            status: 'completed',
          },
        ],
      },
    };
    es.emit('result', JSON.stringify(resultData));

    expect(params.onResult).toHaveBeenCalledWith({
      success: true,
      response: 'Analysis complete',
      targetAgent: 'analyst',
      toolsCalled: ['getServerMetrics', 'detectAnomalies'],
      toolResults: [],
      ragSources: [],
      processingTimeMs: 1200,
      latencyTier: 'slow',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      ttfbMs: 1520,
      routeDecision: {
        intent: 'job',
        executionPath: 'job',
        mode: 'multi',
        complexity: 'complex',
        reasonCodes: ['job_queue_api'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'cloud-run',
      },
      assistantPlan: {
        kind: 'chat',
        planVersion: '2026-05-03-v1',
        routeDecision: {
          intent: 'job',
          executionPath: 'job',
          mode: 'multi',
          complexity: 'complex',
          reasonCodes: ['job_queue_api'],
          ruleVersion: '2026-05-03-v1',
          decidedBy: 'cloud-run',
        },
        executionPath: 'job',
        stream: false,
        job: true,
        reasonCodes: ['job_queue_api'],
        decidedBy: 'cloud-run',
      },
      assistantResult: {
        kind: 'chat',
        resultVersion: '2026-05-03-v1',
        routeDecision: {
          intent: 'job',
          executionPath: 'job',
          mode: 'multi',
          complexity: 'complex',
          reasonCodes: ['job_queue_api'],
          ruleVersion: '2026-05-03-v1',
          decidedBy: 'cloud-run',
        },
        status: 'completed',
      },
      semanticQueryTrace: {
        originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        clarificationRequired: false,
        reasonCodes: ['semantic_frame_evidence_validated'],
      },
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 820,
          error: 'raw tool-call JSON',
        },
        {
          provider: 'mistral',
          modelId: 'mistral-large-latest',
          attempt: 1,
          durationMs: 1540,
        },
      ],
      traceId: 'trace-abc',
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'no_results',
        evidenceCount: 0,
        webUsed: false,
      },
      handoffHistory: [
        { from: 'supervisor', to: 'analyst', reason: 'deep dive' },
      ],
      toolResultSummaries: [
        {
          toolName: 'detectAnomalies',
          label: '이상 탐지',
          summary: '1개 이상 징후를 감지했습니다.',
          status: 'completed',
        },
      ],
    });
  });

  it('calls onError when "error" event has parseable JSON data', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const errorPayload = { error: 'Rate limit exceeded' };
    es.emit('error', JSON.stringify(errorPayload));

    expect(params.onError).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({
        kind: 'rate-limit',
        message: 'Rate limit exceeded',
      })
    );
  });

  it('prefers structured errorDetails from SSE error payload', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit(
      'error',
      JSON.stringify({
        error: 'Cloud Run AI 엔진 요청 제한으로 8초 후 다시 시도해주세요.',
        errorDetails: {
          kind: 'rate-limit',
          message: 'Cloud Run AI 엔진 요청 제한으로 8초 후 다시 시도해주세요.',
          source: 'cloud-run-ai',
          scope: 'minute',
          retryAfterSeconds: 8,
          remaining: 0,
        },
      })
    );

    expect(params.onError).toHaveBeenCalledWith(
      'Cloud Run AI 엔진 요청 제한으로 8초 후 다시 시도해주세요.',
      expect.objectContaining({
        kind: 'rate-limit',
        message: 'Cloud Run AI 엔진 요청 제한으로 8초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 8,
        remaining: 0,
      })
    );
  });

  it('reconnects when the SSE route emits timeout before the job finishes', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const timeoutPayload = { message: 'Request exceeded 60s limit' };
    es.emit('timeout', JSON.stringify(timeoutPayload));

    expect(params.onError).not.toHaveBeenCalled();
    expect(params.onProgress).toHaveBeenCalledWith({
      stage: 'reconnecting',
      progress: 50,
      message: '재연결 중... (1/3)',
    });
    expect(es.readyState).toBe(MockEventSource.CLOSED);

    vi.advanceTimersByTime(100);
    const reconnected = getMock(params.eventSourceRef);
    expect(reconnected).not.toBe(es);
    expect(reconnected.url).toBe('/api/ai/jobs/test-job-123/stream');
  });

  it('reconnects when timeout data is unparseable', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit('timeout', '{invalid-json');

    expect(params.onError).not.toHaveBeenCalled();
    expect(params.onProgress).toHaveBeenCalledWith({
      stage: 'reconnecting',
      progress: 50,
      message: '재연결 중... (1/3)',
    });
  });

  it('calls onError when extractStreamError detects error in result response', () => {
    const params = buildDefaultParams();
    mocks.extractStreamError.mockReturnValue('LLM quota exceeded');

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit(
      'result',
      JSON.stringify({ response: 'some response with hidden error' })
    );

    expect(params.onError).toHaveBeenCalledWith('LLM quota exceeded');
    expect(params.onResult).not.toHaveBeenCalled();
  });

  it('calls onError when result data is not a valid object', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit('result', JSON.stringify(null));

    expect(params.onError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse result')
    );
  });
});
