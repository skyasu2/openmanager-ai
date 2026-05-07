import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTrace,
  mockLangfuse,
  getLangfuse,
  isLangfuseOperational,
  shouldTrackLangfuseEvent,
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
    isLangfuseUsageReady: vi.fn(),
  };
});

vi.mock('./langfuse-client', () => ({
  getLangfuse,
  isLangfuseOperational,
}));

vi.mock('./langfuse-usage', () => ({
  shouldTrackLangfuseEvent,
  isLangfuseUsageReady,
}));

import { createSupervisorTrace } from './langfuse-trace';

describe('langfuse-trace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLangfuseOperational.mockReturnValue(true);
    isLangfuseUsageReady.mockReturnValue(true);
    shouldTrackLangfuseEvent.mockReturnValue(true);
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

  it('assigns a fallback trace id when SDK trace object does not expose one', () => {
    mockTrace.id = undefined;

    const trace = createSupervisorTrace({
      sessionId: 'session-2',
      userId: 'user-2',
      mode: 'multi',
      query: 'server summary',
      requestedMode: 'auto',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'multi',
      upstreamTraceId: 'upstream-trace-1',
    });

    expect(mockLangfuse.trace).toHaveBeenCalledTimes(1);
    const traceCall = mockLangfuse.trace.mock.calls[0]?.[0] as {
      id?: string;
      metadata?: Record<string, unknown>;
    };
    expect(traceCall.id).toMatch(/^[0-9a-f]{32}$/);
    expect(traceCall.metadata).toMatchObject({
      mode: 'multi',
      requestedMode: 'auto',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'multi',
      upstreamTraceId: 'upstream-trace-1',
    });
    expect(mockTrace.score).toHaveBeenCalledWith({
      name: 'requested-mode-auto',
      value: 1,
    });
    expect(mockTrace.score).toHaveBeenCalledWith({
      name: 'resolved-mode-multi',
      value: 1,
    });
    expect(mockTrace.score).toHaveBeenCalledWith({
      name: 'mode-source-auto_complexity',
      value: 1,
    });
    expect(mockTrace.score).toHaveBeenCalledWith({
      name: 'auto-resolved-multi',
      value: 1,
    });
    expect(mockTrace.score).toHaveBeenCalledWith({
      name: 'complexity-selected-multi',
      value: 1,
    });
    expect(trace.id).toBe(traceCall.id);
  });

  it('does not emit mode scores when optional mode audit metadata is absent', () => {
    createSupervisorTrace({
      sessionId: 'session-3',
      userId: 'user-3',
      mode: 'single',
      query: 'hello',
    });

    expect(mockTrace.score).not.toHaveBeenCalled();
  });

});
