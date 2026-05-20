import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockStreamText,
  mockExecuteMultiAgent,
  mockExecuteMultiAgentStream,
  mockGetSupervisorModel,
  mockRecordModelUsage,
  mockIsSingleModeAllowed,
  mockCreateSupervisorTrace,
  mockSelectExecutionMode,
  mockLegacyMonitoringToolExecute,
  mockSearchKnowledgeBaseExecute,
  mockMarkProviderQuotaCooldown,
  mockReconcileProviderQuotaReservation,
  mockReserveProviderQuota,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
  mockExecuteMultiAgent: vi.fn(),
  mockExecuteMultiAgentStream: vi.fn(),
  mockGetSupervisorModel: vi.fn(() => ({
    model: { modelId: 'groq-model' },
    provider: 'groq',
    modelId: 'groq-model',
  })),
  mockRecordModelUsage: vi.fn(async () => undefined),
  mockIsSingleModeAllowed: vi.fn(() => false),
  mockCreateSupervisorTrace: vi.fn(() => ({
    id: 'trace-supervisor-domain-wiring',
    event: vi.fn(),
    score: vi.fn(),
    generation: vi.fn(),
    span: vi.fn(),
    update: vi.fn(),
  })),
  mockSelectExecutionMode: vi.fn(() => 'single'),
  mockLegacyMonitoringToolExecute: vi.fn(async () => ({
    source: 'legacy-all-tools',
  })),
  mockSearchKnowledgeBaseExecute: vi.fn(),
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
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  stepCountIs: vi.fn(() => () => false),
  hasToolCall: vi.fn(() => () => false),
}));

vi.mock('../../tools-ai-sdk', () => ({
  analyzeLargeLog: { execute: vi.fn() },
  analyzePattern: { execute: vi.fn() },
  analyzeScreenshot: { execute: vi.fn() },
  analyzeUrlContent: { execute: vi.fn() },
  buildIncidentTimeline: { execute: vi.fn() },
  computeSeriesStats: { execute: vi.fn() },
  correlateMetrics: { execute: vi.fn() },
  detectAnomalies: { execute: vi.fn() },
  detectAnomaliesAllServers: { execute: vi.fn() },
  enhanceSuggestedActions: { execute: vi.fn() },
  estimateCapacityProjection: { execute: vi.fn() },
  evaluateIncidentReport: { execute: vi.fn() },
  evaluateMathExpression: { execute: vi.fn() },
  filterServers: { execute: vi.fn() },
  finalAnswer: { execute: vi.fn() },
  findRootCause: { execute: vi.fn() },
  getServerByGroup: { execute: vi.fn() },
  getServerByGroupAdvanced: { execute: vi.fn() },
  getServerLogs: { execute: vi.fn() },
  getServerMetrics: { execute: vi.fn() },
  getServerMetricsAdvanced: { execute: vi.fn() },
  predictTrends: { execute: vi.fn() },
  recommendCommands: { execute: vi.fn() },
  refineRootCauseAnalysis: { execute: vi.fn() },
  scoreRootCauseConfidence: { execute: vi.fn() },
  searchKnowledgeBase: { execute: mockSearchKnowledgeBaseExecute },
  searchWeb: { execute: vi.fn() },
  searchWithGrounding: { execute: vi.fn() },
  extendServerCorrelation: { execute: vi.fn() },
  validateReportStructure: { execute: vi.fn() },
  allTools: {
    legacyMonitoringOnly: {
      execute: mockLegacyMonitoringToolExecute,
    },
    searchKnowledgeBase: { execute: mockSearchKnowledgeBaseExecute },
  },
}));

vi.mock('./agents', () => ({
  executeMultiAgent: mockExecuteMultiAgent,
  executeMultiAgentStream: mockExecuteMultiAgentStream,
}));

vi.mock('./model-provider', () => ({
  getSupervisorModel: mockGetSupervisorModel,
  getVisionAgentModel: vi.fn(() => null),
  recordModelUsage: mockRecordModelUsage,
  logProviderStatus: vi.fn(),
}));

vi.mock('../../config/timeout-config', () => ({
  TIMEOUT_CONFIG: {
    supervisor: {
      hard: 30_000,
      hardStreaming: 45_000,
      warning: 10_000,
      warningStreaming: 30_000,
    },
    agent: { hard: 15_000 },
    orchestrator: { hard: 30_000, warning: 10_000, routingDecision: 10_000 },
    subtask: { hard: 15_000 },
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
    getStats: () => ({
      failures: 0,
      totalFailures: 0,
      lastFailure: undefined,
    }),
  })),
}));

vi.mock('../resilience/quota-tracker', () => ({
  markProviderQuotaCooldown: mockMarkProviderQuotaCooldown,
  reconcileProviderQuotaReservation: mockReconcileProviderQuotaReservation,
  reserveProviderQuota: mockReserveProviderQuota,
}));

vi.mock('../../lib/ai-sdk-utils', () => ({
  extractToolResultOutput: vi.fn(
    (toolResult: { result?: unknown; output?: unknown }) =>
      toolResult.result ?? toolResult.output
  ),
  extractRagSources: vi.fn(() => []),
}));

vi.mock('../../lib/error-handler', () => ({
  getPublicErrorMessage: vi.fn((code: string) => code),
  getPublicErrorResponse: vi.fn(() => ({
    code: 'MODEL_ERROR',
    message: 'MODEL_ERROR',
  })),
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
  getLastUserQueryText: vi.fn(
    (messages: Array<{ role: string; content: string }>) =>
      messages.find((message) => message.role === 'user')?.content ?? ''
  ),
}));

import {
  createInMemoryAssistantRuntimeAdapters,
  type AssistantDomain,
  type AssistantRequestContext,
  type DomainEvidenceProvider,
  type DomainIntentFrame,
  type ToolDefinition,
} from '../../core/assistant-runtime';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import { searchKnowledgeBase } from '../../tools-ai-sdk';
import { resolveRAGSetting } from './agents/orchestrator-web-search';
import { createAssistantRuntimeHost } from './assistant-runtime-host';
import { createMonitoringAssistantRuntimeHost } from './monitoring-runtime-host';
import { normalizeSupervisorLocalRouteDecision } from './supervisor-mode';
import { executeSupervisor } from './supervisor-single-agent';
import { executeSupervisorStream } from './supervisor-stream';
import type { SupervisorRequest } from './supervisor-types';

const SAMPLE_TOOL_NAME = 'sampleLookupAccount';
const sampleDataSource = {
  snapshot: vi.fn(async () => ({
    timestamp: '2026-05-06T00:00:00+09:00',
    data: {
      accountId: 'acct-123',
      health: 'warning',
    },
  })),
  history: vi.fn(async () => []),
};

function createSampleDomain(
  tool: ToolDefinition,
  evidenceProviders?: DomainEvidenceProvider[]
): AssistantDomain {
  const domain = {
    id: 'sample-support',
    version: '2026-05-06-test',
    instructions: {
      system: 'Sample support domain.',
    },
    routingPolicy: {
      decide(context: AssistantRequestContext) {
        return {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'single-agent',
          domainId: context.domainId,
          reasonCodes: ['sample_domain_toolset'],
        };
      },
    },
    tools: {
      listTools() {
        return [tool];
      },
      resolveTool(name) {
        return name === tool.name ? tool : undefined;
      },
    },
    dataSource: sampleDataSource,
    ...(evidenceProviders && { evidenceProviders }),
  };

  return domain as AssistantDomain;
}

function createSampleRuntimeHost(
  evidenceProviders?: DomainEvidenceProvider[],
  createPrepareStep?: (
    query: string,
    options?: {
      enableWebSearch?: boolean;
      enableRAG?: boolean;
      intentFrame?: DomainIntentFrame;
    }
  ) => undefined
) {
  const sampleTool: ToolDefinition = {
    name: SAMPLE_TOOL_NAME,
    description: 'Returns deterministic sample account health.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
      },
      required: ['accountId'],
    },
    execute() {
      return {
        accountId: 'acct-123',
        health: 'warning',
      };
    },
  };

  return createAssistantRuntimeHost({
    domain: createSampleDomain(sampleTool, evidenceProviders),
    adapters: createInMemoryAssistantRuntimeAdapters(),
    adapterKinds: {
      stateStore: 'in-memory',
      sessionStore: 'in-memory',
      jobQueue: 'in-memory',
    },
    executionAdapter: {
      ...(createPrepareStep && { createPrepareStep }),
      executeLLMStream(params) {
        return mockStreamText(params);
      },
      executeLLMGenerate(params) {
        return mockGenerateText(params);
      },
    },
  });
}

function createSupervisorRequest(
  runtimeHost = createSampleRuntimeHost()
): SupervisorRequest {
  return {
    mode: 'auto',
    messages: [{ role: 'user', content: 'account health please' }],
    sessionId: 'session-domain-wiring',
    enableRAG: false,
    enableWebSearch: false,
    runtimeHost,
  };
}

function readToolNames(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function readSystemPrompt(value: unknown): string | undefined {
  const messages = (value as { messages?: Array<{ content?: unknown }> })
    .messages;
  const firstMessage = messages?.[0];
  return typeof firstMessage?.content === 'string'
    ? firstMessage.content
    : undefined;
}

const sampleIntentFrame: DomainIntentFrame = {
  domainId: 'openmanager-monitoring',
  intent: 'anomaly_detection',
  capabilityId: 'monitoring.anomaly_detection',
  scope: 'whole_fleet',
  targets: [],
  ambiguity: 'low',
  executionMode: 'single',
  confidence: 0.91,
};

describe('supervisor domain wiring contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sampleDataSource.snapshot.mockClear();
    sampleDataSource.history.mockClear();
    mockIsSingleModeAllowed.mockReturnValue(false);
    mockSelectExecutionMode.mockReturnValue('single');
    mockGenerateText.mockResolvedValue({
      text: 'sample single-agent response',
      steps: [],
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'sample stream response';
      })(),
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'sample stream response' };
      })(),
      steps: Promise.resolve([]),
      usage: Promise.resolve({
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
      }),
    });
    mockExecuteMultiAgentStream.mockImplementation(async function* () {});
  });

  it('uses the injected runtime host domain toolset for supervisor stream execution', async () => {
    const events = [];
    for await (const event of executeSupervisorStream(
      createSupervisorRequest()
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: { success: true },
    });
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    const tools = (mockStreamText.mock.calls[0]?.[0] as { tools?: unknown })
      .tools;
    const systemPrompt = readSystemPrompt(mockStreamText.mock.calls[0]?.[0]);

    expect(readToolNames(tools)).toContain(SAMPLE_TOOL_NAME);
    expect(readToolNames(tools)).not.toContain('legacyMonitoringOnly');
    expect(systemPrompt).toBe('Sample support domain.');
  });

  it('uses the injected runtime host domain toolset for supervisor single-agent execution', async () => {
    const result = await executeSupervisor(createSupervisorRequest());

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    const tools = (mockGenerateText.mock.calls[0]?.[0] as { tools?: unknown })
      .tools;
    const systemPrompt = readSystemPrompt(mockGenerateText.mock.calls[0]?.[0]);

    expect(readToolNames(tools)).toContain(SAMPLE_TOOL_NAME);
    expect(readToolNames(tools)).not.toContain('legacyMonitoringOnly');
    expect(systemPrompt).toBe('Sample support domain.');
  });

  it('passes semantic intentFrame into single-agent prepareStep options', async () => {
    const createPrepareStep = vi.fn(() => undefined);
    const runtimeHost = createSampleRuntimeHost(undefined, createPrepareStep);

    await executeSupervisor({
      ...createSupervisorRequest(runtimeHost),
      metadata: { intentFrame: sampleIntentFrame },
    });

    expect(createPrepareStep).toHaveBeenCalledWith(
      'account health please',
      expect.objectContaining({
        enableWebSearch: false,
        enableRAG: false,
        intentFrame: expect.objectContaining({
          capabilityId: 'monitoring.anomaly_detection',
          confidence: 0.91,
        }),
      })
    );
  });

  it('passes semantic intentFrame into stream prepareStep options', async () => {
    const createPrepareStep = vi.fn(() => undefined);
    const runtimeHost = createSampleRuntimeHost(undefined, createPrepareStep);
    const events = [];

    for await (const event of executeSupervisorStream({
      ...createSupervisorRequest(runtimeHost),
      metadata: { intentFrame: sampleIntentFrame },
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: { success: true },
    });
    expect(createPrepareStep).toHaveBeenCalledWith(
      'account health please',
      expect.objectContaining({
        enableWebSearch: false,
        enableRAG: false,
        intentFrame: expect.objectContaining({
          capabilityId: 'monitoring.anomaly_detection',
          confidence: 0.91,
        }),
      })
    );
  });

  it('passes the injected runtime host domain data source to multi-agent execution', async () => {
    mockSelectExecutionMode.mockReturnValue('multi');
    mockExecuteMultiAgent.mockResolvedValue({
      success: true,
      response: 'sample multi-agent response',
      handoffs: [],
      finalAgent: 'Sample Agent',
      toolsCalled: [],
      usage: {
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
      },
      metadata: {
        provider: 'mock',
        modelId: 'mock-model',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 1,
      },
    });

    const result = await executeSupervisor(createSupervisorRequest());

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockExecuteMultiAgent).toHaveBeenCalledTimes(1);
    expect(mockExecuteMultiAgent.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        domainId: 'sample-support',
        dataSource: sampleDataSource,
      })
    );
  });

  it('passes deterministic domain evidence into multi-agent stream execution', async () => {
    mockSelectExecutionMode.mockReturnValue('multi');
    mockExecuteMultiAgentStream.mockImplementation(async function* () {
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            provider: 'mock-orchestrator',
          },
        },
      };
    });

    const evidenceProvider: DomainEvidenceProvider = {
      id: 'sample-stream-evidence',
      canHandle: () => true,
      async resolve() {
        return {
          id: 'sample-stream-evidence',
          prompt: '[Deterministic sample stream evidence]\nKeep account acct-123 unchanged.',
          fallback: 'acct-123 is the deterministic account.',
        };
      },
    };

    const events = [];
    for await (const event of executeSupervisorStream(
      createSupervisorRequest(createSampleRuntimeHost([evidenceProvider]))
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        success: true,
        metadata: {
          provider: 'mock-orchestrator',
          semanticQueryTrace: {
            originalQuery: 'account health please',
            selectedDomain: 'sample-support',
            selectedEvidenceProvider: 'sample-stream-evidence',
            evidenceAvailable: true,
            clarificationRequired: false,
            reasonCodes: expect.arrayContaining([
              'semantic_frame_raw_fallback_used',
              'semantic_frame_evidence_validated',
            ]),
          },
        },
      },
    });
    expect(mockExecuteMultiAgentStream).toHaveBeenCalledTimes(1);
    expect(mockExecuteMultiAgentStream.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        domainEvidencePrompt: expect.stringContaining(
          '[Deterministic sample stream evidence]'
        ),
      })
    );
  });

  it('short-circuits composite peak-advice evidence to a deterministic read-only answer', async () => {
    const runtimeHost = createMonitoringAssistantRuntimeHost();
    const events = [];

    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: '최근 하루 load 피크 시간과 대응 방법 알려줘',
        },
      ],
      sessionId: 'session-peak-advice-safety',
      enableRAG: false,
      enableWebSearch: false,
      runtimeHost,
    })) {
      events.push(event);
    }

    const streamedText = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');
    const doneEvent = events.find((event) => event.type === 'done');

    expect(mockStreamText).not.toHaveBeenCalled();
    expect(mockExecuteMultiAgentStream).not.toHaveBeenCalled();
    expect(streamedText).toContain('최고 시간대');
    expect(streamedText).toContain('읽기 전용 확인 항목');
    expect(streamedText).not.toMatch(
      /apt(?:-get)?\s+install|systemctl\s+restart/i
    );
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['monitoring-peak-metric'],
        metadata: {
          provider: 'deterministic',
          modelId: 'monitoring-peak-metric',
          semanticQueryTrace: {
            selectedCapability: 'monitoring.metric_peak',
            selectedEvidenceProvider: 'monitoring-peak-metric',
            evidenceAvailable: true,
            clarificationRequired: false,
          },
        },
      },
    });
  });

  it.each([
    {
      query: '현재 CPU 사용률 상위 3대 알려줘',
      providerId: 'monitoring-metric-ranking',
      capabilityId: 'monitoring.metric_ranking',
      expectedText: 'CPU 사용률 상위 3대',
    },
    {
      query: '현재 모든 서버 상태 요약해줘',
      providerId: 'monitoring-server-health',
      capabilityId: 'monitoring.server_health',
      expectedText: '서버 현황 요약',
    },
  ])(
    'short-circuits $providerId evidence to a zero-token deterministic stream answer',
    async ({ query, providerId, capabilityId, expectedText }) => {
      const runtimeHost = createMonitoringAssistantRuntimeHost();
      const events = [];

      for await (const event of executeSupervisorStream({
        mode: 'auto',
        messages: [{ role: 'user', content: query }],
        sessionId: `session-${providerId}`,
        enableRAG: false,
        enableWebSearch: false,
        runtimeHost,
      })) {
        events.push(event);
      }

      const streamedText = events
        .filter((event) => event.type === 'text_delta')
        .map((event) => String(event.data))
        .join('');
      const doneEvent = events.find((event) => event.type === 'done');

      expect(mockStreamText).not.toHaveBeenCalled();
      expect(mockExecuteMultiAgentStream).not.toHaveBeenCalled();
      expect(streamedText).toContain(expectedText);
      expect(doneEvent).toMatchObject({
        type: 'done',
        data: {
          success: true,
          toolsCalled: [providerId],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: {
            provider: 'deterministic',
            modelId: providerId,
            domainEvidence: {
              id: providerId,
              responsePolicy: 'deterministic_answer',
              capabilityId,
            },
            semanticQueryTrace: {
              selectedCapability: capabilityId,
              selectedEvidenceProvider: providerId,
              evidenceAvailable: true,
              clarificationRequired: false,
            },
          },
        },
      });
    }
  );

  it('short-circuits forced KRL SSOT queries to direct knowledge search before multi-agent routing', async () => {
    mockSelectExecutionMode.mockReturnValue('multi');
    vi.mocked(resolveRAGSetting).mockReturnValue(true);
    vi.mocked(searchKnowledgeBase.execute).mockResolvedValue({
      results: [
        {
          id: 'otel-ssot-krl',
          title: 'OpenManager OTel 데이터 SSOT 경로',
          content:
            'OpenManager는 pre-generated OTel data slot을 SSOT로 사용합니다. 18대 서버 상태 판단은 OTel 현재 슬롯의 warning, critical, offline 집계 기준을 따르고 KRL은 절차/설명 근거를 제공합니다.',
          sourceType: 'knowledge',
          score: 0.91,
        },
      ],
    });

    const runtimeHost = createMonitoringAssistantRuntimeHost();
    const events = [];

    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content:
            'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
        },
      ],
      sessionId: 'session-krl-ssot-direct',
      enableRAG: 'auto',
      enableWebSearch: false,
      runtimeHost,
    })) {
      events.push(event);
    }

    const streamedText = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');
    const doneEvent = events.find((event) => event.type === 'done');

    expect(mockExecuteMultiAgentStream).not.toHaveBeenCalled();
    expect(searchKnowledgeBase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        fastMode: true,
        includeWebSearch: false,
      })
    );
    expect(streamedText).toContain('OpenManager OTel 데이터 SSOT 경로');
    expect(streamedText).toContain('pre-generated OTel');
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['searchKnowledgeBase'],
        metadata: {
          provider: 'deterministic',
          modelId: 'knowledge-search-direct',
        },
      },
    });
  });

  it('returns a safe deterministic warning when forced KRL direct knowledge search fails', async () => {
    mockSelectExecutionMode.mockReturnValue('multi');
    vi.mocked(resolveRAGSetting).mockReturnValue(true);
    vi.mocked(searchKnowledgeBase.execute).mockRejectedValue(
      new Error('knowledge search unavailable')
    );

    const runtimeHost = createMonitoringAssistantRuntimeHost();
    const events = [];

    for await (const event of executeSupervisorStream({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content:
            'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
        },
      ],
      sessionId: 'session-krl-ssot-direct-failure',
      enableRAG: 'auto',
      enableWebSearch: false,
      runtimeHost,
    })) {
      events.push(event);
    }

    const streamedText = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');
    const warningEvent = events.find((event) => event.type === 'warning');
    const doneEvent = events.find((event) => event.type === 'done');

    expect(mockExecuteMultiAgentStream).not.toHaveBeenCalled();
    expect(streamedText).toContain('내부 지식 검색을 실행하지 못했습니다.');
    expect(streamedText).toContain('검색 근거 없이');
    expect(warningEvent).toMatchObject({
      type: 'warning',
      data: { code: 'RAG_SEARCH_FAILED' },
    });
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['searchKnowledgeBase'],
        metadata: {
          provider: 'deterministic',
          modelId: 'knowledge-search-direct',
        },
        warning: {
          code: 'RAG_SEARCH_FAILED',
        },
      },
    });
  });

  it('keeps monitoring compatibility tools available through the default monitoring domain pack', () => {
    const host = createMonitoringAssistantRuntimeHost();
    const context: AssistantRequestContext = {
      requestId: 'monitoring-compatibility-tools',
      domainId: monitoringDomainPack.id,
      message: 'CPU 상태 알려줘',
      messages: [{ role: 'user', content: 'CPU 상태 알려줘' }],
      sessionId: 'monitoring-compatibility-session',
    };

    expect(host.domain).toBe(monitoringDomainPack);
    expect(host.domain.tools.listTools(context).map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'searchKnowledgeBase',
        'searchWeb',
        'getServerMetricsAdvanced',
        'finalAnswer',
      ])
    );
  });

  it('preserves non-monitoring artifact kinds from domain route decisions', () => {
    expect(
      normalizeSupervisorLocalRouteDecision({
        intent: 'artifact',
        executionPath: 'client-artifact',
        decidedBy: 'bff',
        artifactKind: 'sample-health-summary',
        reasonCodes: ['sample_health_summary_requested'],
      })
    ).toMatchObject({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'sample-health-summary',
      decidedBy: 'bff',
    });
  });

  it('keeps supervisor mode free of direct monitoring artifact registry ownership', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/services/ai-sdk/supervisor-mode.ts'),
      'utf8'
    );

    expect(source).not.toMatch(
      /from ['"]\.\.\/\.\.\/domains\/monitoring\/artifact-registry['"]/
    );
    expect(source).not.toContain('detectMonitoringArtifactKind');
    expect(source).not.toContain('MONITORING_ARTIFACT_KINDS');
  });

  it('keeps supervisor execution free of direct monitoring prompt and prepare-step helpers', () => {
    const executionFiles = [
      'src/services/ai-sdk/supervisor-stream.ts',
      'src/services/ai-sdk/supervisor-single-agent.ts',
      'src/services/ai-sdk/supervisor-stream-messages.ts',
    ];

    for (const file of executionFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');

      expect(source).not.toMatch(
        /import\s*\{[\s\S]*?createSystemPrompt[\s\S]*?\}\s*from ['"]\.\/supervisor-routing['"]/
      );
      expect(source).not.toMatch(
        /import\s*\{[\s\S]*?createPrepareStep[\s\S]*?\}\s*from ['"]\.\/supervisor-routing['"]/
      );
    }
  });
});
