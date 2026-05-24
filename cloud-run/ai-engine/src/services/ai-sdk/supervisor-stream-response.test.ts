import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateUIMessageStream,
  mockCreateUIMessageStreamResponse,
  mockGenerateId,
  mockExecuteSupervisorStream,
  mockResolveSupervisorModeDecision,
  mockBuildSupervisorModeMetadata,
  mockBuildSupervisorRouteDecision,
  mockBuildSupervisorAssistantPlan,
  mockBuildSupervisorAssistantResult,
  mockFlushLangfuseBestEffort,
  mockSessionGetHistory,
  mockSessionSaveHistory,
} = vi.hoisted(() => ({
  mockCreateUIMessageStream: vi.fn((config: unknown) => config),
  mockCreateUIMessageStreamResponse: vi.fn((params: unknown) => params),
  mockGenerateId: vi.fn(() => 'nonce-1'),
  mockExecuteSupervisorStream: vi.fn(),
  mockResolveSupervisorModeDecision: vi.fn(() => ({
    requestedMode: 'auto',
    resolvedMode: 'single',
    modeSelectionSource: 'auto_complexity',
    autoSelectedByComplexity: 'single',
  })),
  mockBuildSupervisorModeMetadata: vi.fn((decision: Record<string, unknown>) => ({
    requestedMode: decision.requestedMode,
    resolvedMode: decision.resolvedMode,
    modeSelectionSource: decision.modeSelectionSource,
    ...(decision.autoSelectedByComplexity
      ? { autoSelectedByComplexity: decision.autoSelectedByComplexity }
      : {}),
  })),
  mockBuildSupervisorRouteDecision: vi.fn(() => ({
    intent: 'chat',
    executionPath: 'stream',
    mode: 'single',
    reasonCodes: ['auto_complexity'],
    ruleVersion: '2026-05-03-v1',
    decidedBy: 'cloud-run',
  })),
  mockBuildSupervisorAssistantPlan: vi.fn((routeDecision: Record<string, unknown>) => ({
    kind: 'chat',
    planVersion: '2026-05-03-v1',
    routeDecision,
    executionPath: 'stream',
    stream: true,
    job: false,
    reasonCodes: routeDecision.reasonCodes,
    decidedBy: 'cloud-run',
  })),
  mockBuildSupervisorAssistantResult: vi.fn((routeDecision: Record<string, unknown>) => ({
    kind: 'chat',
    resultVersion: '2026-05-03-v1',
    routeDecision,
    status: 'completed',
  })),
  mockFlushLangfuseBestEffort: vi.fn(async () => undefined),
  mockSessionGetHistory: vi.fn(async () => []),
  mockSessionSaveHistory: vi.fn(async () => undefined),
}));

vi.mock('ai', () => ({
  createUIMessageStream: mockCreateUIMessageStream,
  createUIMessageStreamResponse: mockCreateUIMessageStreamResponse,
  generateId: mockGenerateId,
}));

vi.mock('./supervisor-single-agent', () => ({
  executeSupervisorStream: mockExecuteSupervisorStream,
}));

vi.mock('./supervisor-mode', () => ({
  resolveSupervisorModeDecision: mockResolveSupervisorModeDecision,
  buildSupervisorModeMetadata: mockBuildSupervisorModeMetadata,
  buildSupervisorRouteDecision: mockBuildSupervisorRouteDecision,
  buildSupervisorAssistantPlanForRequest: mockBuildSupervisorAssistantPlan,
  buildSupervisorAssistantResult: mockBuildSupervisorAssistantResult,
}));

vi.mock('../../lib/error-handler', () => ({
  getPublicErrorResponse: vi.fn(() => ({
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
  })),
  sanitizeErrorData: vi.fn((data: Record<string, unknown>) => data),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../observability/langfuse-flush', () => ({
  flushLangfuseBestEffort: mockFlushLangfuseBestEffort,
}));

vi.mock('./session-memory', () => ({
  SessionMemoryService: {
    getHistory: mockSessionGetHistory,
    saveHistory: mockSessionSaveHistory,
  },
}));

import { createSupervisorStreamResponse } from './supervisor-stream-response';

describe('createSupervisorStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionGetHistory.mockResolvedValue([]);
    mockSessionSaveHistory.mockResolvedValue(undefined);
    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield { type: 'text_delta', data: 'CPU 42%' };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            mode: 'single',
            provider: 'groq',
            modelId: 'groq-model',
            requestedMode: 'auto',
            resolvedMode: 'single',
            modeSelectionSource: 'auto_complexity',
            autoSelectedByComplexity: 'single',
          },
        },
      };
    })());
  });

  it('emits data-mode with mode audit metadata and forwards the original request to stream execution', async () => {
    const request = {
      sessionId: 'session-1',
      mode: 'auto' as const,
      messages: [{ role: 'user' as const, content: 'CPU 알려줘' }],
    };

    const response = createSupervisorStreamResponse(request) as unknown as {
      stream: {
        execute: (args: { writer: { write: (chunk: unknown) => void } }) => Promise<void>;
      };
      headers: Record<string, string>;
    };

    const writes: unknown[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk: unknown) => {
          writes.push(chunk);
        },
      },
    });

    expect(mockExecuteSupervisorStream).toHaveBeenCalledWith(request);
    expect(response.headers).toMatchObject({
      'X-Session-Id': 'session-1',
      'X-Stream-Protocol': 'ui-message-stream',
    });
    expect(writes).toContainEqual(
      expect.objectContaining({
        type: 'data-mode',
        data: expect.objectContaining({
        mode: 'single',
        requestedMode: 'auto',
        resolvedMode: 'single',
        modeSelectionSource: 'auto_complexity',
        autoSelectedByComplexity: 'single',
        assistantPlan: expect.objectContaining({
          kind: 'chat',
          executionPath: 'stream',
          stream: true,
          job: false,
          decidedBy: 'cloud-run',
        }),
        }),
      }),
    );
    expect(writes).toContainEqual(
      expect.objectContaining({
        type: 'data-done',
        data: expect.objectContaining({
          success: true,
          responseSummary: 'CPU 42%',
          metadata: expect.objectContaining({
            requestedMode: 'auto',
            resolvedMode: 'single',
            modeSelectionSource: 'auto_complexity',
            autoSelectedByComplexity: 'single',
            routeDecision: {
              intent: 'chat',
              executionPath: 'stream',
              mode: 'single',
              reasonCodes: ['auto_complexity'],
              ruleVersion: '2026-05-03-v1',
              decidedBy: 'cloud-run',
            },
            assistantPlan: expect.objectContaining({
              kind: 'chat',
              executionPath: 'stream',
              stream: true,
              job: false,
              decidedBy: 'cloud-run',
            }),
            assistantResult: expect.objectContaining({
              kind: 'chat',
              status: 'completed',
              routeDecision: expect.objectContaining({
                intent: 'chat',
                executionPath: 'stream',
              }),
            }),
          }),
        }),
      }),
    );
    expect(mockFlushLangfuseBestEffort).toHaveBeenCalledWith('UIMessageStream');
  });

  it('restores Redis session history before stream execution and persists the assistant response', async () => {
    mockSessionGetHistory.mockResolvedValue([
      { role: 'user', content: '지금 당장 조치가 필요한 서버가 있어?' },
      {
        role: 'assistant',
        content:
          '🚨 즉시 조치 필요 여부\n• 관찰 우선 서버: db-mysql-dc1-backup',
      },
    ]);
    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield {
        type: 'text_delta',
        data: '📊 **지정 서버 네트워크 70% 이상 서버**\n',
      };
      yield {
        type: 'text_delta',
        data: '• 대상: 지정 서버 1대\n',
      };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            provider: 'deterministic',
            modelId: 'monitoring-metric-current',
          },
        },
      };
    })());

    const request = {
      sessionId: 'session-contextual-follow-up',
      mode: 'auto' as const,
      messages: [
        {
          role: 'user' as const,
          content: '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘',
        },
      ],
    };
    const response = createSupervisorStreamResponse(request) as unknown as {
      stream: {
        execute: (args: {
          writer: { write: (chunk: unknown) => void };
        }) => Promise<void>;
      };
    };

    const writes: unknown[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk: unknown) => {
          writes.push(chunk);
        },
      },
    });

    expect(mockExecuteSupervisorStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: '지금 당장 조치가 필요한 서버가 있어?' },
          {
            role: 'assistant',
            content:
              '🚨 즉시 조치 필요 여부\n• 관찰 우선 서버: db-mysql-dc1-backup',
          },
          {
            role: 'user',
            content: '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘',
          },
        ],
      })
    );
    expect(mockSessionSaveHistory).toHaveBeenCalledWith(
      'session-contextual-follow-up',
      [
        { role: 'user', content: '지금 당장 조치가 필요한 서버가 있어?' },
        {
          role: 'assistant',
          content:
            '🚨 즉시 조치 필요 여부\n• 관찰 우선 서버: db-mysql-dc1-backup',
        },
        {
          role: 'user',
          content: '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘',
        },
        {
          role: 'assistant',
          content:
            '📊 **지정 서버 네트워크 70% 이상 서버**• 대상: 지정 서버 1대',
        },
      ]
    );
    expect(writes).toContainEqual(
      expect.objectContaining({
        type: 'data-done',
        data: expect.objectContaining({
          responseSummary:
            '📊 **지정 서버 네트워크 70% 이상 서버**• 대상: 지정 서버 1대',
        }),
      })
    );
  });

  it('maps agent_step stream events to data-agent-step UI parts', async () => {
    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield {
        type: 'agent_step',
        data: {
          tool: 'getServerMetrics',
          status: 'start',
        },
      };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            mode: 'single',
            provider: 'groq',
            modelId: 'groq-model',
          },
        },
      };
    })());

    const response = createSupervisorStreamResponse({
      sessionId: 'session-agent-step',
      mode: 'auto',
      messages: [{ role: 'user', content: 'CPU 알려줘' }],
    }) as unknown as {
      stream: {
        execute: (args: {
          writer: { write: (chunk: unknown) => void };
        }) => Promise<void>;
      };
    };

    const writes: unknown[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk: unknown) => {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toContainEqual({
      type: 'data-agent-step',
      data: {
        tool: 'getServerMetrics',
        status: 'start',
      },
    });
  });

  it('preserves upstream semanticQueryTrace when mapping done to data-done', async () => {
    const semanticQueryTrace = {
      originalQuery: '최근 24시간 전체 서버 load1 이상치 구간과 범인 서버는?',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      selectedEvidenceProvider: 'monitoring-peak-metric',
      evidenceAvailable: true,
      clarificationRequired: false,
      reasonCodes: ['semantic_frame_evidence_validated'],
    };

    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield { type: 'text_delta', data: 'load1 피크는 03:50입니다.' };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            mode: 'multi',
            provider: 'mock-orchestrator',
            semanticQueryTrace,
          },
        },
      };
    })());

    const response = createSupervisorStreamResponse({
      sessionId: 'session-semantic-trace',
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: '최근 24시간 전체 서버 load1 이상치 구간과 범인 서버는?',
        },
      ],
    }) as unknown as {
      stream: {
        execute: (args: {
          writer: { write: (chunk: unknown) => void };
        }) => Promise<void>;
      };
    };

    const writes: unknown[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk: unknown) => {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toContainEqual(
      expect.objectContaining({
        type: 'data-done',
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            provider: 'mock-orchestrator',
            semanticQueryTrace,
            assistantResult: expect.objectContaining({
              status: 'completed',
            }),
          }),
        }),
      })
    );
  });
});
