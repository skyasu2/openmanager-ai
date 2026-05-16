import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockStreamText,
  mockExecuteMultiAgent,
  mockGetSupervisorModel,
  mockRecordModelUsage,
  mockIsSingleModeAllowed,
  mockCreateSupervisorTrace,
  mockSelectExecutionMode,
  mockExtractRagSources,
  mockSearchWebExecute,
  mockMarkProviderQuotaCooldown,
  mockReconcileProviderQuotaReservation,
  mockReserveProviderQuota,
  mockWaitBeforeSupervisorProviderFallback,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
  mockExecuteMultiAgent: vi.fn(),
  mockGetSupervisorModel: vi.fn(() => ({
    model: { modelId: 'groq-model' },
    provider: 'groq',
    modelId: 'groq-model',
  })),
  mockRecordModelUsage: vi.fn(async () => undefined),
  mockIsSingleModeAllowed: vi.fn(() => false),
  mockCreateSupervisorTrace: vi.fn(() => ({
    id: 'trace-supervisor-test',
    event: vi.fn(),
    score: vi.fn(),
    generation: vi.fn(),
    span: vi.fn(),
    update: vi.fn(),
  })),
  mockSelectExecutionMode: vi.fn(() => 'multi'),
  mockExtractRagSources: vi.fn(() => []),
  mockSearchWebExecute: vi.fn(async () => ({
    success: true,
    answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
    results: [
      {
        title: 'Next.js 16.2',
        url: 'https://nextjs.org/blog/next-16-2',
        content: 'Next.js 16.2 is now available.',
      },
    ],
  })),
  mockMarkProviderQuotaCooldown: vi.fn(async () => undefined),
  mockReconcileProviderQuotaReservation: vi.fn(async () => undefined),
  mockReserveProviderQuota: vi.fn(
    (provider: string, estimatedTokens: number, modelId?: string) =>
      Promise.resolve({
        reserved: true,
        provider,
        modelId,
        estimatedTokens,
        status: {},
      })
  ),
  mockWaitBeforeSupervisorProviderFallback: vi.fn(async () => undefined),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  stepCountIs: vi.fn(() => () => false),
  hasToolCall: vi.fn(() => () => false),
}));

vi.mock('./agents', () => ({
  executeMultiAgent: mockExecuteMultiAgent,
  executeMultiAgentStream: vi.fn(async function* () {
    yield { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } };
  }),
}));

vi.mock('./model-provider', () => ({
  getSupervisorModel: mockGetSupervisorModel,
  getVisionAgentModel: vi.fn(() => null),
  recordModelUsage: mockRecordModelUsage,
  logProviderStatus: vi.fn(),
}));

vi.mock('./stream-provider-fallback', () => ({
  waitBeforeSupervisorProviderFallback: mockWaitBeforeSupervisorProviderFallback,
}));

vi.mock('../../config/timeout-config', () => ({
  TIMEOUT_CONFIG: {
    supervisor: { hard: 30_000, hardStreaming: 45_000, warning: 10_000, warningStreaming: 30_000 },
    agent: { hard: 15_000 },
    orchestrator: { hard: 30_000, warning: 10_000, routingDecision: 10_000 },
    subtask: { hard: 15_000 },
  },
}));

vi.mock('../../tools-ai-sdk', () => ({
  allTools: {
    searchWeb: {
      execute: mockSearchWebExecute,
    },
  },
}));

vi.mock('../../domains/monitoring/domain-pack', () => ({
  createMonitoringDomainInstructions: vi.fn(() => ({
    system: 'monitoring test domain',
    locale: 'ko-KR',
  })),
  monitoringDomainPack: {
    id: 'openmanager-monitoring',
    version: 'test',
    instructions: {
      system: 'monitoring test domain',
      locale: 'ko-KR',
    },
    routingPolicy: {
      decide: () => ({
        kind: 'chat',
        executionPath: 'stream',
        executionMode: 'single-agent',
        domainId: 'openmanager-monitoring',
        reasonCodes: ['monitoring_test_route'],
      }),
    },
    tools: {
      listTools: () => [],
      resolveTool: () => undefined,
    },
  },
}));

vi.mock('./agents/orchestrator-web-search', () => ({
  filterToolsByRAG: vi.fn((tools: unknown) => tools),
  filterToolsByWebSearch: vi.fn((tools: unknown) => tools),
  resolveRAGSetting: vi.fn(() => false),
  resolveWebSearchSetting: vi.fn(() => false),
}));

vi.mock('../../lib/tavily-web-search-client', () => ({
  isTavilyAvailable: vi.fn(() => true),
}));

vi.mock('../observability/langfuse', () => ({
  createSupervisorTrace: mockCreateSupervisorTrace,
  logGeneration: vi.fn(),
  logToolCall: vi.fn(),
  finalizeTrace: vi.fn(),
}));

vi.mock('../resilience/circuit-breaker', () => ({
  CircuitOpenError: class CircuitOpenError extends Error {},
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
    execute: async (fn: () => Promise<unknown>) => await fn(),
    getStats: () => ({ failures: 0, totalFailures: 0, lastFailure: undefined }),
  })),
}));

vi.mock('../resilience/quota-tracker', () => ({
  markProviderQuotaCooldown: mockMarkProviderQuotaCooldown,
  reconcileProviderQuotaReservation: mockReconcileProviderQuotaReservation,
  reserveProviderQuota: mockReserveProviderQuota,
}));

vi.mock('../../lib/ai-sdk-utils', () => ({
  extractToolResultOutput: vi.fn((toolResult: { result?: unknown; output?: unknown }) => {
    const output = toolResult.result ?? toolResult.output;
    if (output && typeof output === 'object') {
      const envelope = output as Record<string, unknown>;
      if (
        typeof envelope.type === 'string' &&
        (envelope.type === 'json' || envelope.type === 'text') &&
        'value' in envelope
      ) {
        return envelope.value;
      }
    }
    return output;
  }),
  extractRagSources: mockExtractRagSources,
  extractEvidenceCards: vi.fn((toolName: string, output: unknown) =>
    mockExtractRagSources(toolName, output).map((source, index) => ({
      id: `mock-${toolName}-${index}`,
      title: source.title,
      summary: source.title,
      sourceType: source.sourceType === 'web' ? 'web' : 'knowledge',
      score: source.similarity,
      ...(source.category && { category: source.category }),
      ...(source.url && { url: source.url }),
    }))
  ),
  extractRetrievalMetadata: vi.fn(() => undefined),
  mergeRetrievalMetadata: vi.fn((current: unknown, next: unknown) => next ?? current),
}));

vi.mock('../../lib/error-handler', () => ({
  getPublicErrorMessage: vi.fn((code: string) => code),
  getPublicErrorResponse: vi.fn(() => ({ code: 'MODEL_ERROR', message: 'MODEL_ERROR' })),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/config-parser', () => ({
  isSingleModeAllowed: mockIsSingleModeAllowed,
  getUpstashConfig: vi.fn(() => ({
    restUrl: '',
    restToken: '',
    configured: false,
  })),
}));

vi.mock('../../domains/monitoring/routing-policy', () => ({
  createSystemPrompt: vi.fn(() => 'system-prompt'),
  RETRY_CONFIG: {
    maxRetries: 0,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'MODEL_ERROR'],
    retryDelayMs: 1,
  },
  selectExecutionMode: mockSelectExecutionMode,
  getIntentCategory: vi.fn(() => 'general'),
  getLLMParamsForIntent: vi.fn(() => ({
    temperature: 0.3,
    maxOutputTokens: 2048,
  })),
  createPrepareStep: vi.fn(() => undefined),
}));

vi.mock('./agents/response-quality', () => ({
  evaluateAgentResponseQuality: vi.fn((_agentName: string, text: string) => ({
    responseChars: text.length,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('./supervisor-quality-retry', () => ({
  shouldRetryForQuality: vi.fn(() => false),
}));

vi.mock('./supervisor-stream-messages', () => ({
  buildSupervisorStreamMessages: vi.fn(
    (
      request: { messages: Array<{ role: string; content: string }> },
      systemPrompt: string
    ) => [{ role: 'system', content: systemPrompt }, ...request.messages]
  ),
  getLastUserQueryText: vi.fn((messages: Array<{ role: string; content: string }>) => messages.find((message) => message.role === 'user')?.content ?? ''),
}));

import { executeSupervisor } from './supervisor-single-agent';
import { executeSupervisorStream } from './supervisor-stream';

describe('supervisor degraded single fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSingleModeAllowed.mockReturnValue(false);
    mockSelectExecutionMode.mockReturnValue('multi');
    mockExtractRagSources.mockReturnValue([]);
    mockSearchWebExecute.mockResolvedValue({
      success: true,
      answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
      results: [
        {
          title: 'Next.js 16.2',
          url: 'https://nextjs.org/blog/next-16-2',
          content: 'Next.js 16.2 is now available.',
        },
      ],
    });
    mockExecuteMultiAgent.mockResolvedValue({
      success: false,
      code: 'MODEL_UNAVAILABLE',
      error: 'Orchestrator not available',
    });
    mockGenerateText.mockResolvedValue({
      text: 'single fallback response',
      steps: [],
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'single fallback stream';
      })(),
      steps: Promise.resolve([]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });
  });

  it('keeps auto low-complexity requests on single-agent path even when degraded single is disallowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);
    mockSelectExecutionMode.mockReturnValue('single');

    const result = await executeSupervisor({
      mode: 'auto',
      messages: [{ role: 'user', content: 'CPU 알려줘' }],
      sessionId: 'session-auto-single',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe('single fallback response');
      expect(result.metadata.mode).toBe('single');
      expect(result.metadata.provider).toBe('groq');
      expect(result.metadata.requestedMode).toBe('auto');
      expect(result.metadata.resolvedMode).toBe('single');
      expect(result.metadata.modeSelectionSource).toBe('auto_complexity');
      expect(result.metadata.autoSelectedByComplexity).toBe('single');
    }
    expect(mockExecuteMultiAgent).not.toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('prefers deterministic advanced metric ranking over empty finalAnswer in direct single-agent execution', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      steps: [
        {
          toolCalls: [
            { toolCallId: 'metrics-call', toolName: 'getServerMetricsAdvanced' },
            { toolCallId: 'final-answer-call', toolName: 'finalAnswer' },
          ],
          toolResults: [
            {
              toolCallId: 'metrics-call',
              toolName: 'getServerMetricsAdvanced',
              result: {
                responseKind: 'current_metric_ranking',
                servers: [
                  {
                    id: 'api-was-dc1-01',
                    name: 'api-was-dc1-01',
                    status: 'online',
                    metrics: { cpu: 85 },
                  },
                  {
                    id: 'api-was-dc1-02',
                    name: 'api-was-dc1-02',
                    status: 'online',
                    metrics: { cpu: 78 },
                  },
                  {
                    id: 'db-mysql-dc1-primary',
                    name: 'db-mysql-dc1-primary',
                    status: 'online',
                    metrics: { cpu: 76 },
                  },
                ],
              },
            },
            {
              toolCallId: 'final-answer-call',
              toolName: 'finalAnswer',
              result: { answer: 'CPU 부하가 가장 높은 서버 TOP 3는 없습니다.' },
            },
          ],
        },
      ],
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });

    const result = await executeSupervisor({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: '현재 가장 CPU 부하가 높은 서버 TOP 3',
        },
      ],
      sessionId: 'session-direct-advanced-ranking',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toContain('📊 **CPU 사용률 상위 3대**');
      expect(result.response).toContain('1. api-was-dc1-01: CPU 85%');
      expect(result.response).toContain('2. api-was-dc1-02: CPU 78%');
      expect(result.response).toContain('3. db-mysql-dc1-primary: CPU 76%');
      expect(result.response).not.toContain('없습니다');
    }
  });

  it('strips internal response scaffold from direct single-agent final answers', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      steps: [
        {
          toolCalls: [{ toolCallId: 'final-answer-call', toolName: 'finalAnswer' }],
          toolResults: [
            {
              toolCallId: 'final-answer-call',
              toolName: 'finalAnswer',
              result: {
                answer:
                  '[응답 가이드] 지난 24시간 CPU 가장 높은 서버: api-was-dc1-01 (cpu_max=96%). 이 값을 사용자에게 전달하세요.',
              },
            },
          ],
        },
      ],
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });

    const result = await executeSupervisor({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: '24시간 동안 CPU 가장 높았던 서버',
        },
      ],
      sessionId: 'session-direct-scaffold-sanitizer',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toContain('지난 24시간 CPU 가장 높은 서버');
      expect(result.response).toContain('api-was-dc1-01');
      expect(result.response).not.toContain('[응답 가이드]');
      expect(result.response).not.toContain('이 값을 사용자에게 전달하세요');
    }
  });

  it('short-circuits off-domain realtime queries before direct single-agent model routing', async () => {
    mockSelectExecutionMode.mockReturnValue('single');

    const result = await executeSupervisor({
      mode: 'auto',
      messages: [{ role: 'user', content: '오늘 날씨 어때?' }],
      sessionId: 'session-direct-off-domain',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toContain('실시간 외부 조회 도구가 연결되어 있지 않아');
      expect(result.metadata.provider).toBe('deterministic');
      expect(result.metadata.modelId).toBe('off-domain-guard');
      expect(result.toolsCalled).toEqual([]);
    }
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('falls back to single-agent when multi-agent returns MODEL_UNAVAILABLE and degraded single is allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-fallback',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe('single fallback response');
      expect(result.metadata.mode).toBe('single');
      expect(result.metadata.provider).toBe('groq');
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.fallbackReason).toBe('multi_agent_model_unavailable');
      expect(result.metadata.requestedMode).toBe('multi');
      expect(result.metadata.resolvedMode).toBe('multi');
      expect(result.metadata.modeSelectionSource).toBe('explicit');
      expect(result.metadata.degradedFromMode).toBe('multi');
      expect(result.metadata.degradedReason).toBe('multi_agent_model_unavailable');
    }
    expect(mockExecuteMultiAgent).toHaveBeenCalledTimes(1);
    expect(mockExecuteMultiAgent).toHaveBeenCalledWith(expect.objectContaining({
      requestedMode: 'multi',
      resolvedMode: 'multi',
      modeSelectionSource: 'explicit',
    }));
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('propagates multi-agent retrieval metadata and evidence cards', async () => {
    mockExecuteMultiAgent.mockResolvedValueOnce({
      success: true,
      response: '토폴로지 요약',
      handoffs: [{ from: 'Orchestrator', to: 'Advisor Agent', reason: 'Forced routing' }],
      finalAgent: 'Advisor Agent',
      toolsCalled: ['searchKnowledgeBase', 'finalAnswer'],
      ragSources: [
        {
          title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
          similarity: 0.91,
          sourceType: 'knowledge',
          category: 'architecture',
        },
      ],
      evidenceCards: [
        {
          id: 'kb-1',
          title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
          summary: '총 18대 서버 기준 토폴로지 근거',
          sourceType: 'knowledge',
          score: 0.91,
          category: 'architecture',
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        provider: 'deterministic',
        modelId: 'knowledge-search-direct',
        totalRounds: 1,
        handoffCount: 1,
        durationMs: 10,
        retrieval: {
          retrievalEnabled: true,
          retrievalUsed: true,
          retrievalMode: 'lite',
          evidenceCount: 1,
          webUsed: false,
        },
      },
    });

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '현재 인프라 토폴로지 알려줘' }],
      sessionId: 'session-retrieval-propagation',
      enableRAG: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.evidenceCards).toHaveLength(1);
      expect(result.metadata.retrieval).toEqual(
        expect.objectContaining({
          retrievalEnabled: true,
          retrievalUsed: true,
          retrievalMode: 'lite',
          evidenceCount: 1,
        })
      );
    }
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('falls back to single-agent when multi-agent returns UNKNOWN_ERROR and degraded single is allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);
    mockExecuteMultiAgent.mockResolvedValue({
      success: false,
      code: 'UNKNOWN_ERROR',
      error: 'Internal Server Error',
    });

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '현재 인프라 아키텍처와 트래픽 경로를 요약해줘' }],
      sessionId: 'session-fallback-unknown',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe('single fallback response');
      expect(result.metadata.mode).toBe('single');
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.fallbackReason).toBe('multi_agent_runtime_error');
      expect(result.metadata.degradedFromMode).toBe('multi');
      expect(result.metadata.degradedReason).toBe('multi_agent_runtime_error');
    }
    expect(mockExecuteMultiAgent).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('keeps fail-fast behavior when degraded single is not allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-fail-fast',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('MODEL_UNAVAILABLE');
    }
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('falls back to single-agent stream when multi-agent stream emits initial MODEL_UNAVAILABLE error', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-stream-fallback',
    })) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({
      type: 'agent_status',
      data: {
        agent: 'Orchestrator',
        status: 'processing',
        message: '오케스트레이터 오류로 단일 분석 모드로 전환합니다.',
      },
    });
    expect(events).toContainEqual({ type: 'text_delta', data: 'single fallback stream' });
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        metadata: {
          mode: 'single',
          provider: 'groq',
          fallback: true,
          fallbackReason: 'multi_agent_model_unavailable',
          requestedMode: 'multi',
          resolvedMode: 'multi',
          modeSelectionSource: 'explicit',
          degradedFromMode: 'multi',
          degradedReason: 'multi_agent_model_unavailable',
        },
      },
    });
  });

  it('streams service command guidance directly before model routing', async () => {
    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [
        {
          role: 'user',
          content:
            'Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘',
        },
      ],
      sessionId: 'session-command-direct',
    })) {
      events.push(event);
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'text_delta',
        data: expect.stringContaining('/var/log/nginx/access.log'),
      })
    );
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        toolsCalled: ['recommendCommands'],
        metadata: {
          provider: 'deterministic',
          modelId: 'service-command-catalog',
        },
      },
    });
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('streams disk capacity command guidance directly before model routing', async () => {
    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [
        {
          role: 'user',
          content: 'db-mysql-dc1-primary 디스크 86%, 용량 확보 명령어는?',
        },
      ],
      sessionId: 'session-disk-command-direct',
    })) {
      events.push(event);
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'text_delta',
        data: expect.stringContaining('df -h'),
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'text_delta',
        data: expect.stringContaining('du -xhd1 / 2>/dev/null | sort -hr | head -20'),
      })
    );
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        toolsCalled: ['recommendCommands'],
        metadata: {
          provider: 'deterministic',
          modelId: 'service-command-catalog',
        },
      },
    });
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('prefers deterministic advanced metric ranking over empty finalAnswer recovery in single-agent stream', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockStreamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'error', error: new Error('provider stream ended after tool result') };
      })(),
      textStream: (async function* () {})(),
      steps: Promise.resolve([
        {
          toolCalls: [
            { toolName: 'getServerMetricsAdvanced' },
            { toolName: 'finalAnswer' },
          ],
          toolResults: [
            {
              toolName: 'getServerMetricsAdvanced',
              result: {
                responseKind: 'current_metric_ranking',
                servers: [
                  {
                    id: 'api-was-dc1-01',
                    name: 'api-was-dc1-01',
                    metrics: { cpu: 85 },
                  },
                  {
                    id: 'api-was-dc1-02',
                    name: 'api-was-dc1-02',
                    metrics: { cpu: 78 },
                  },
                  {
                    id: 'db-mysql-dc1-primary',
                    name: 'db-mysql-dc1-primary',
                    metrics: { cpu: 76 },
                  },
                ],
              },
            },
            {
              toolName: 'finalAnswer',
              result: { answer: 'CPU 상위 3대 서버는 없습니다.' },
            },
          ],
        },
      ]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: 'CPU 상위 3개 서버를 현재 대시보드 수치 기준으로 짧게 알려줘',
        },
      ],
      sessionId: 'session-advanced-ranking',
    })) {
      events.push(event);
    }

    const text = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(text).toContain('📊 **CPU 사용률 상위 3대**');
    expect(text).toContain('1. api-was-dc1-01: CPU 85%');
    expect(text).toContain('2. api-was-dc1-02: CPU 78%');
    expect(text).toContain('3. db-mysql-dc1-primary: CPU 76%');
    expect(text).not.toContain('서버는 없습니다');

    const warningEvents = events.filter((event) => event.type === 'warning');
    expect(warningEvents).toHaveLength(0);
    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toMatchObject({
      data: {
        success: true,
        metadata: {
          assistantResult: {
            status: 'completed',
          },
        },
      },
    });
  });

  it('retries the next provider before emitting generic empty-response fallback', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockGetSupervisorModel
      .mockReturnValueOnce({
        model: { modelId: 'groq-model' },
        provider: 'groq',
        modelId: 'groq-model',
      })
      .mockReturnValueOnce({
        model: { modelId: 'cerebras-model' },
        provider: 'cerebras',
        modelId: 'cerebras-model',
      });
    mockStreamText
      .mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: 'error', error: new Error('empty provider output') };
        })(),
        textStream: (async function* () {})(),
        steps: Promise.resolve([]),
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 0, totalTokens: 1 }),
      })
      .mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: 'text-delta',
            text: 'second provider recovered answer',
          };
        })(),
        textStream: (async function* () {})(),
        steps: Promise.resolve([]),
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
      });

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-provider-retry-before-empty-fallback',
    })) {
      events.push(event);
    }

    const text = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(mockStreamText).toHaveBeenCalledTimes(2);
    expect(mockWaitBeforeSupervisorProviderFallback).toHaveBeenCalledWith(
      'groq',
      'empty_output_with_error'
    );
    expect(text).toContain('second provider recovered answer');
    expect(text).not.toContain('응답 본문이 비어');
  });

  it('keeps original stream error when degraded single is not allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-stream-fail-fast',
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } },
    ]);
  });

  it('uses hardStreaming timeout for single-agent streaming path', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [{ role: 'user', content: 'degraded single timeout 테스트' }],
      sessionId: 'session-single-stream-timeout',
    })) {
      events.push(event);
    }

    expect(events).toContainEqual({ type: 'text_delta', data: 'single fallback stream' });
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: expect.objectContaining({
          totalMs: 45_000,
          stepMs: 15_000,
          chunkMs: 30_000,
        }),
      })
    );
  });

  it('uses streaming warning threshold for single-agent streaming path', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        nowMs += 31_000;
        yield 'single fallback stream';
      })(),
      steps: Promise.resolve([]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });

    const events = [];
    try {
      for await (const event of executeSupervisorStream({
        mode: 'multi',
        messages: [{ role: 'user', content: 'degraded single warning threshold 테스트' }],
        sessionId: 'session-single-stream-warning-threshold',
      })) {
        events.push(event);
      }
    } finally {
      nowSpy.mockRestore();
    }

    const warningEvent = events.find((event) => event.type === 'warning');
    expect(warningEvent).toBeDefined();
    expect(warningEvent).toMatchObject({
      type: 'warning',
      data: {
        code: 'SLOW_PROCESSING',
        threshold: 30_000,
      },
    });
  });

  it('emits agent_step start and done events from streamed tool parts', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield '메트릭 분석 중';
      })(),
      fullStream: (async function* () {
        yield {
          type: 'tool-call',
          toolCallId: 'tool-call-1',
          toolName: 'getServerMetrics',
          input: { serverId: 'all' },
        };
        yield {
          type: 'text-delta',
          id: 'text-1',
          text: '메트릭 분석 중',
        };
        yield {
          type: 'tool-result',
          toolCallId: 'tool-call-1',
          toolName: 'getServerMetrics',
          output: { success: true },
        };
      })(),
      steps: Promise.resolve([
        {
          toolCalls: [
            {
              toolCallId: 'tool-call-1',
              toolName: 'getServerMetrics',
            },
          ],
          toolResults: [
            {
              toolCallId: 'tool-call-1',
              toolName: 'getServerMetrics',
              result: { success: true },
            },
          ],
        },
      ]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [{ role: 'user', content: '서버 메트릭 조회해줘' }],
      sessionId: 'session-agent-step-stream',
    })) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: 'agent_step',
      data: {
        tool: 'getServerMetrics',
        status: 'start',
      },
    });
    expect(events).toContainEqual({
      type: 'agent_step',
      data: {
        tool: 'getServerMetrics',
        status: 'done',
      },
    });
  });

  it('recovers an empty web-search stream from streamed tool-result output', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockExtractRagSources.mockImplementation((toolName: string) =>
      toolName === 'searchWeb'
        ? [
            {
              title: 'Next.js 16.2',
              similarity: 0.9,
              sourceType: 'web',
              url: 'https://nextjs.org/blog/next-16-2',
            },
          ]
        : []
    );
    mockStreamText.mockReturnValue({
      textStream: (async function* () {})(),
      fullStream: (async function* () {
        yield {
          type: 'tool-call',
          toolCallId: 'web-call-1',
          toolName: 'searchWeb',
          input: { query: 'Next.js latest stable release' },
        };
        yield {
          type: 'tool-result',
          toolCallId: 'web-call-1',
          toolName: 'searchWeb',
          output: {
            type: 'json',
            value: {
              success: true,
              answer: 'Next.js 최신 안정화 메이저 버전은 16입니다.',
              results: [
                {
                  title: 'Next.js 16.2',
                  url: 'https://nextjs.org/blog/next-16-2',
                  content: 'Next.js 16.2 is now available.',
                },
              ],
            },
          },
        };
      })(),
      steps: Promise.resolve([]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: 'Next.js 최신 안정화 메이저 버전을 출처와 함께 알려줘',
        },
      ],
      sessionId: 'session-web-stream-tool-result',
    })) {
      events.push(event);
    }

    const text = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(text).toContain('Next.js 최신 안정화 메이저 버전은 16입니다.');
    expect(text).toContain('https://nextjs.org/blog/next-16-2');
    expect(text).not.toContain('응답 본문이 비어');
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: 'warning',
        data: expect.objectContaining({ code: 'EMPTY_RESPONSE' }),
      })
    );
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['searchWeb'],
      },
    });
  });

  it('re-executes searchWeb from tool-call input when an empty stream has no recoverable tool result', async () => {
    mockSelectExecutionMode.mockReturnValue('single');
    mockExtractRagSources.mockImplementation((toolName: string) =>
      toolName === 'searchWeb'
        ? [
            {
              title: 'Next.js 16.2',
              similarity: 0.9,
              sourceType: 'web',
              url: 'https://nextjs.org/blog/next-16-2',
            },
          ]
        : []
    );
    mockStreamText.mockReturnValue({
      textStream: (async function* () {})(),
      fullStream: (async function* () {
        yield {
          type: 'tool-call',
          toolCallId: 'web-call-2',
          toolName: 'searchWeb',
          input: {
            query: 'Next.js latest stable release official Next.js blog',
            maxResults: 5,
            searchDepth: 'advanced',
            includeDomains: ['nextjs.org'],
          },
        };
      })(),
      steps: Promise.resolve([
        {
          toolCalls: [
            {
              toolCallId: 'web-call-2',
              toolName: 'searchWeb',
              input: {
                query: 'Next.js latest stable release official Next.js blog',
                maxResults: 5,
                searchDepth: 'advanced',
                includeDomains: ['nextjs.org'],
              },
            },
          ],
          toolResults: [],
        },
      ]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: 'Next.js 최신 안정화 메이저 버전을 출처와 함께 알려줘',
        },
      ],
      sessionId: 'session-web-search-reexecute-fallback',
    })) {
      events.push(event);
    }

    const text = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(mockSearchWebExecute).toHaveBeenCalledWith({
      query: 'Next.js 최신 안정화 메이저 버전을 출처와 함께 알려줘',
      maxResults: 5,
      searchDepth: 'advanced',
      includeDomains: ['nextjs.org'],
      excludeDomains: undefined,
    });
    expect(text).toContain('Next.js 최신 안정화 메이저 버전은 16입니다.');
    expect(text).toContain('https://nextjs.org/blog/next-16-2');
    expect(text).not.toContain('응답 본문이 비어');
  });
});
