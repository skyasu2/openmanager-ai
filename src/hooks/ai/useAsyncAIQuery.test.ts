/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AsyncQueryResult,
  buildAsyncQueryJobRequestBody,
  useAsyncAIQuery,
} from './useAsyncAIQuery';

vi.mock('@/utils/security/csrf-client', () => ({
  createCSRFHeaders: vi.fn(async (headers?: Record<string, string>) => ({
    ...(headers ?? {}),
    'x-csrf-token': 'test-token',
  })),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const eventSources: MockEventSource[] = [];

class MockEventSource {
  static CLOSED = 2;
  readonly url: string;
  readyState = 0;
  private readonly listeners = new Map<string, EventListener[]>();

  constructor(url: string) {
    this.url = url;
    eventSources.push(this);
  }

  addEventListener(type: string, handler: EventListener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, handler]);
  }

  removeEventListener(type: string, handler: EventListener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((candidate) => candidate !== handler)
    );
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, data?: unknown) {
    const event = {
      type,
      data: typeof data === 'string' ? data : JSON.stringify(data),
    } as MessageEvent;

    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

function mockJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

describe('buildAsyncQueryJobRequestBody', () => {
  it('includes source toggles, semantic metadata, and log extract in job metadata', () => {
    const body = buildAsyncQueryJobRequestBody('로그 원인 분석', 'session-1', {
      enableRAG: false,
      enableWebSearch: true,
      queryAsOfDataSlot: {
        slotIndex: 12,
        minuteOfDay: 120,
        timeLabel: '02:00',
      },
      intentFrame: {
        domainId: 'openmanager-monitoring',
        intent: 'log_analysis',
        capabilityId: 'monitoring.log_analysis',
        scope: 'whole_fleet',
        targets: [],
        ambiguity: 'low',
        confidence: 0.91,
      },
      semanticQueryTrace: {
        originalQuery: '로그 원인 분석',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.log_analysis',
        selectedEvidenceProvider: 'monitoring-log-evidence',
        evidenceAvailable: true,
        clarificationRequired: false,
        reasonCodes: ['semantic_frame_evidence_validated'],
      },
      inputType: 'log_paste',
      logExtract: 'ERROR database timeout',
    });

    expect(body).toEqual({
      query: '로그 원인 분석',
      options: {
        sessionId: 'session-1',
        metadata: {
          enableRAG: false,
          enableWebSearch: true,
          queryAsOfDataSlot: {
            slotIndex: 12,
            minuteOfDay: 120,
            timeLabel: '02:00',
          },
          intentFrame: {
            domainId: 'openmanager-monitoring',
            intent: 'log_analysis',
            capabilityId: 'monitoring.log_analysis',
            scope: 'whole_fleet',
            targets: [],
            ambiguity: 'low',
            confidence: 0.91,
          },
          semanticQueryTrace: {
            originalQuery: '로그 원인 분석',
            selectedDomain: 'openmanager-monitoring',
            selectedCapability: 'monitoring.log_analysis',
            selectedEvidenceProvider: 'monitoring-log-evidence',
            evidenceAvailable: true,
            clarificationRequired: false,
            reasonCodes: ['semantic_frame_evidence_validated'],
          },
          inputType: 'log_paste',
          logExtract: 'ERROR database timeout',
        },
      },
    });
  });
});

describe('useAsyncAIQuery', () => {
  beforeEach(() => {
    eventSources.length = 0;
    vi.clearAllMocks();
  });

  it('retryJob uses an abortable request and resolves with the replacement jobId', async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({ jobId: 'retry-job-2', retryCount: 1 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAsyncAIQuery({ timeout: 5000 }));
    let retryPromise!: Promise<AsyncQueryResult>;

    act(() => {
      retryPromise = result.current.retryJob('failed-job-1');
    });

    await waitFor(() => {
      expect(eventSources).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/jobs/failed-job-1/retry',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );

    act(() => {
      eventSources[0]?.emit('result', {
        response: '재시도 완료',
        metadata: { traceId: 'trace-retry-1' },
      });
    });

    await expect(retryPromise).resolves.toMatchObject({
      success: true,
      response: '재시도 완료',
      jobId: 'retry-job-2',
      traceId: 'trace-retry-1',
    });
  });
});
