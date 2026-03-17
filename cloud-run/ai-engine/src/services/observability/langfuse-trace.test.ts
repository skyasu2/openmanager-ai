import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTrace,
  mockLangfuse,
  getLangfuse,
  isLangfuseOperational,
  shouldTrackLangfuseEvent,
  consumeLangfuseQuota,
  isLangfuseUsageReady,
} = vi.hoisted(() => {
  const mockTrace = {
    id: 'trace-1',
    generation: vi.fn(),
    span: vi.fn(),
    event: vi.fn(),
    update: vi.fn(),
    score: vi.fn(),
  };

  const mockLangfuse = {
    trace: vi.fn(() => mockTrace),
    score: vi.fn(),
    flushAsync: vi.fn(),
    shutdownAsync: vi.fn(),
  };

  return {
    mockTrace,
    mockLangfuse,
    getLangfuse: vi.fn(() => mockLangfuse),
    isLangfuseOperational: vi.fn(),
    shouldTrackLangfuseEvent: vi.fn(),
    consumeLangfuseQuota: vi.fn(),
    isLangfuseUsageReady: vi.fn(),
  };
});

vi.mock('./langfuse-client', () => ({
  getLangfuse,
  isLangfuseOperational,
}));

vi.mock('./langfuse-usage', () => ({
  shouldTrackLangfuseEvent,
  consumeLangfuseQuota,
  isLangfuseUsageReady,
}));

import { createSupervisorTrace, scoreByTraceId } from './langfuse-trace';

describe('langfuse-trace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLangfuseOperational.mockReturnValue(true);
    isLangfuseUsageReady.mockReturnValue(true);
    shouldTrackLangfuseEvent.mockReturnValue(true);
    consumeLangfuseQuota.mockReturnValue(true);
  });

  it('returns no-op trace before Langfuse is operational', () => {
    isLangfuseOperational.mockReturnValue(false);

    const trace = createSupervisorTrace({
      sessionId: 'session-1',
      userId: 'user-1',
      mode: 'auto',
      query: 'status',
    });

    expect(shouldTrackLangfuseEvent).not.toHaveBeenCalled();
    expect(getLangfuse).not.toHaveBeenCalled();
    expect(trace.id).toBeUndefined();
  });

  it('returns false for scoring before usage restore is ready', () => {
    isLangfuseUsageReady.mockReturnValue(false);

    const recorded = scoreByTraceId('trace-1', 'user-feedback', 1);

    expect(recorded).toBe(false);
    expect(consumeLangfuseQuota).not.toHaveBeenCalled();
    expect(getLangfuse).not.toHaveBeenCalled();
  });

  it('assigns a fallback trace id when SDK trace object does not expose one', () => {
    mockTrace.id = undefined;

    const trace = createSupervisorTrace({
      sessionId: 'session-2',
      userId: 'user-2',
      mode: 'multi',
      query: 'server summary',
      upstreamTraceId: 'upstream-trace-1',
    });

    expect(mockLangfuse.trace).toHaveBeenCalledTimes(1);
    const traceCall = mockLangfuse.trace.mock.calls[0]?.[0] as { id?: string };
    expect(traceCall.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(trace.id).toBe(traceCall.id);
  });
});
