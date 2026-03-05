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

  it('calls onResult with parsed data when "result" event fires', () => {
    const params = buildDefaultParams();
    mocks.extractStreamError.mockReturnValue(null);

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const resultData = {
      response: 'Analysis complete',
      targetAgent: 'analyst',
      toolResults: [],
      ragSources: [],
      processingTimeMs: 1200,
      metadata: { traceId: 'trace-abc' },
    };
    es.emit('result', JSON.stringify(resultData));

    expect(params.onResult).toHaveBeenCalledWith({
      success: true,
      response: 'Analysis complete',
      targetAgent: 'analyst',
      toolResults: [],
      ragSources: [],
      processingTimeMs: 1200,
      traceId: 'trace-abc',
    });
  });

  it('calls onError when "error" event has parseable JSON data', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const errorPayload = { error: 'Rate limit exceeded' };
    es.emit('error', JSON.stringify(errorPayload));

    expect(params.onError).toHaveBeenCalledWith('Rate limit exceeded');
  });

  it('calls onError with timeout message when "timeout" event fires', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    const timeoutPayload = { message: 'Request exceeded 60s limit' };
    es.emit('timeout', JSON.stringify(timeoutPayload));

    expect(params.onError).toHaveBeenCalledWith('Request exceeded 60s limit');
  });

  it('falls back to default timeout message when timeout data is unparseable', () => {
    const params = buildDefaultParams();

    connectAsyncQuerySSE(params);

    const es = getMock(params.eventSourceRef);
    es.emit('timeout', '{invalid-json');

    expect(params.onError).toHaveBeenCalledWith('Request timeout');
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
