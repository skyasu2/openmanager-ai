import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { mockStepCountIs } = vi.hoisted(() => ({
  mockStepCountIs: vi.fn(() => () => false),
}));

const {
  mockEvaluateAgentResponseQuality,
  mockGenerateTextWithRetry,
  mockSearchKnowledgeBaseExecute,
} =
  vi.hoisted(() => ({
    mockEvaluateAgentResponseQuality: vi.fn(
      (_agentName: string, text: string) => ({
        responseChars: text.length,
        formatCompliance: true,
        qualityFlags: [],
        latencyTier: 'fast',
      })
    ),
    mockGenerateTextWithRetry: vi.fn(),
    mockSearchKnowledgeBaseExecute: vi.fn(),
  }));

vi.mock('ai', () => ({
  generateText: vi.fn(),
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: mockStepCountIs,
}));

vi.mock('../../resilience/retry-with-fallback', () => ({
  generateTextWithRetry: mockGenerateTextWithRetry,
}));

vi.mock('../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../../lib/ai-sdk-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/ai-sdk-utils')>()),
  extractToolResultOutput: vi.fn(
    (toolResult: { result?: unknown; output?: unknown }) =>
      toolResult.result ?? toolResult.output
  ),
}));

vi.mock('./config', () => ({
  AGENT_NAMES: ['Metrics Query Agent', 'Advisor Agent', 'Analyst Agent'],
  AGENT_CONFIGS: {
    'Metrics Query Agent': {
      name: 'Metrics Query Agent',
      instructions: 'Test instructions',
      tools: {
        getServerMetrics: { execute: vi.fn() },
        finalAnswer: { execute: vi.fn() },
      },
      getModel: vi.fn(() => ({ provider: 'cerebras' })),
    },
    'Advisor Agent': {
      name: 'Advisor Agent',
      instructions: 'Advisor instructions',
      tools: {
        searchKnowledgeBase: { execute: mockSearchKnowledgeBaseExecute },
        recommendCommands: { execute: vi.fn() },
        finalAnswer: { execute: vi.fn() },
      },
      getModel: vi.fn(() => ({ provider: 'cerebras' })),
    },
    'Analyst Agent': {
      name: 'Analyst Agent',
      instructions: 'Analyst instructions',
      tools: {
        detectAnomaliesAllServers: { execute: vi.fn() },
        detectAnomalies: { execute: vi.fn() },
        finalAnswer: { execute: vi.fn() },
      },
      getModel: vi.fn(() => ({ provider: 'cerebras' })),
    },
  },
  getAgentEvidenceBudget: vi.fn((agentName: string) =>
    agentName === 'Reporter Agent' ? 6 : agentName === 'Advisor Agent' ? 5 : 3
  ),
  getAgentMaxSteps: vi.fn((agentName: string) =>
    agentName === 'Analyst Agent' || agentName === 'Reporter Agent'
      ? 5
      : agentName === 'Vision Agent'
        ? 2
        : 4
  ),
  MISTRAL_FIRST_PROVIDER_ORDER: ['mistral', 'zai', 'groq', 'cerebras'],
  getAgentProviderOrder: vi.fn((agentName: string) =>
    agentName === 'Analyst Agent'
      ? ['mistral', 'groq', 'zai', 'cerebras']
      : agentName === 'Reporter Agent'
        ? ['zai', 'mistral', 'groq', 'cerebras']
        : agentName === 'Advisor Agent'
          ? ['mistral', 'zai', 'groq', 'cerebras']
          : ['groq', 'zai', 'mistral', 'cerebras']
  ),
  getOrchestratorProviderOrder: vi.fn(() => [
    'cerebras',
    'mistral',
    'zai',
    'groq',
  ]),
  getAgentConfig: (name: string) =>
    name === 'Metrics Query Agent'
      ? {
          name: 'Metrics Query Agent',
          instructions: 'Test instructions',
          tools: {
            getServerMetrics: { execute: vi.fn() },
            finalAnswer: { execute: vi.fn() },
          },
          getModel: vi.fn(() => ({ provider: 'cerebras' })),
        }
        : name === 'Advisor Agent'
          ? {
              name: 'Advisor Agent',
            instructions: 'Advisor instructions',
            tools: {
              searchKnowledgeBase: { execute: mockSearchKnowledgeBaseExecute },
              recommendCommands: { execute: vi.fn() },
              finalAnswer: { execute: vi.fn() },
              },
              getModel: vi.fn(() => ({ provider: 'cerebras' })),
            }
          : name === 'Analyst Agent'
            ? {
                name: 'Analyst Agent',
                instructions: 'Analyst instructions',
                tools: {
                  detectAnomaliesAllServers: { execute: vi.fn() },
                  detectAnomalies: { execute: vi.fn() },
                  finalAnswer: { execute: vi.fn() },
                },
                getModel: vi.fn(() => ({ provider: 'cerebras' })),
              }
        : undefined,
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: vi.fn(() => null),
}));

vi.mock('./reporter-pipeline', () => ({
  executeReporterPipeline: vi.fn(),
}));

vi.mock('../../observability/langfuse', () => ({
  createSupervisorTrace: vi.fn(() => ({ score: vi.fn() })),
}));

vi.mock('./agent-factory', () => ({
  AgentFactory: {
    create: vi.fn(),
    createByName: vi.fn(),
  },
}));

vi.mock('../../../config/timeout-config', () => ({
  TIMEOUT_CONFIG: {
    agent: { hard: 60_000 },
    subtask: { hard: 30_000 },
  },
}));

vi.mock('./orchestrator-web-search', () => ({
  filterToolsByWebSearch: vi.fn((tools: unknown) => tools),
  filterToolsByRAG: vi.fn((tools: unknown) => tools),
}));

vi.mock('./response-quality', () => ({
  evaluateAgentResponseQuality: mockEvaluateAgentResponseQuality,
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  ORCHESTRATOR_PROVIDER_ORDER,
  executeWithAgentFactory,
  executeForcedRouting,
  getAgentMaxSteps,
  getAgentProviderOrder,
} from './orchestrator-routing';
import { AgentFactory } from './agent-factory';

function createRetryResult(options: {
  text?: string;
  usedFallback?: boolean;
  attempts?: Array<{
    provider: 'cerebras' | 'groq' | 'mistral';
    modelId: string;
    attempt: number;
    durationMs: number;
    error?: string;
  }>;
  steps?: Array<{
    toolCalls?: Array<{ toolName: string }>;
    toolResults?: Array<{
      toolName: string;
      result?: unknown;
      output?: unknown;
    }>;
  }>;
}) {
  return {
    success: true,
    provider: 'cerebras',
    modelId: 'cerebras-model',
    usedFallback: options.usedFallback ?? false,
    totalDurationMs: 10,
    attempts: options.attempts ?? [
      {
        provider: 'cerebras',
        modelId: 'cerebras-model',
        attempt: 1,
        durationMs: 10,
      },
    ],
    result: {
      text: options.text ?? '',
      steps: (options.steps ?? []).map((step) => ({
        toolCalls: step.toolCalls ?? [],
        toolResults: step.toolResults ?? [],
      })),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  };
}

function createResourceCatalog(serverIds: string[]) {
  return {
    resources: Object.fromEntries(
      serverIds.map((serverId, index) => [
        serverId,
        {
          'server.role': index % 2 === 0 ? 'web' : 'app',
          'cloud.availability_zone': `test-az-${index + 1}`,
        },
      ])
    ),
  };
}

function createTestDataSource(serverIds = ['web-01', 'api-01', 'db-01']) {
  return {
    async snapshot() {
      return {
        timestamp: '2026-05-06T00:00:00+09:00',
        data: {
          alerts: [],
          servers: serverIds.map((serverId, index) => ({
            id: serverId,
            status: index === 0 ? 'warning' : 'online',
            cpu: index === 0 ? 82 : 40,
            memory: index === 0 ? 70 : 45,
            disk: 50,
          })),
        },
      };
    },
    async history() {
      return [];
    },
  };
}

describe('executeForcedRouting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStepCountIs.mockClear();
    mockEvaluateAgentResponseQuality.mockImplementation(
      (_agentName: string, text: string) => ({
        responseChars: text.length,
        formatCompliance: true,
        qualityFlags: [],
        latencyTier: 'fast',
      })
    );
    mockSearchKnowledgeBaseExecute.mockResolvedValue(undefined);
  });

  it('returns expanded max steps only for Analyst/Reporter agents', () => {
    expect(getAgentMaxSteps('Metrics Query Agent')).toBe(4);
    expect(getAgentMaxSteps('Advisor Agent')).toBe(4);
    expect(getAgentMaxSteps('Vision Agent')).toBe(2);
    expect(getAgentMaxSteps('Analyst Agent')).toBe(5);
    expect(getAgentMaxSteps('Reporter Agent')).toBe(5);
  });

  it('injects Analyst anomaly prefetch evidence into forced-routing system prompt', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '사전 수집된 근거로 분석했습니다.',
        steps: [],
      })
    );

    const result = await executeForcedRouting(
      '전체 장애 원인을 분석해줘',
      'Analyst Agent',
      Date.now()
    );

    expect(result?.success).toBe(true);
    const firstCall = mockGenerateTextWithRetry.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };

    expect(firstCall.messages?.[0]?.content).toContain(
      'Analyst precomputed anomaly evidence'
    );
    expect(firstCall.messages?.[0]?.content).toContain(
      'Do not call detectAnomaliesAllServers again'
    );
  });

  it('uses deterministic fallback for empty Metrics Query summary responses without a second retry call', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '   ',
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    {
                      id: 'web-01',
                      status: 'online',
                      cpu: 32,
                      memory: 48,
                      disk: 28,
                    },
                    {
                      id: 'api-01',
                      status: 'warning',
                      cpu: 71,
                      memory: 78,
                      disk: 36,
                    },
                    {
                      id: 'db-01',
                      status: 'online',
                      cpu: 40,
                      memory: 56,
                      disk: 42,
                    },
                  ],
                  alertServers: [
                    {
                      id: 'api-01',
                      status: 'warning',
                      cpu: 71,
                      memory: 78,
                      disk: 36,
                      memoryTrend: 'rising',
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const result = await executeForcedRouting(
      '현재 모든 서버의 상태를 요약해줘',
      'Metrics Query Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource()
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('📊 **서버 현황 요약**');
    expect(result?.response).toContain('api-01');
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
    expect(mockStepCountIs).toHaveBeenCalledWith(4);
    expect(mockGenerateTextWithRetry.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 2048,
    });
    expect(result?.metadata.agentLoop).toEqual({
      implementation: 'core-generate-text',
      maxSteps: 4,
      maxOutputTokens: 2048,
      sdkMaxRetries: 0,
      stepsExecuted: 1,
    });
  });

  it('overrides generated summary text with deterministic summary for parity-sensitive prompts', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '잘못된 요약입니다.',
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    {
                      id: 'web-01',
                      status: 'online',
                      cpu: 32,
                      memory: 48,
                      disk: 28,
                    },
                    {
                      id: 'api-01',
                      status: 'warning',
                      cpu: 71,
                      memory: 78,
                      disk: 36,
                    },
                    {
                      id: 'db-01',
                      status: 'online',
                      cpu: 40,
                      memory: 56,
                      disk: 42,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const result = await executeForcedRouting(
      '현재 모든 서버의 상태를 요약해줘',
      'Metrics Query Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource()
    );

    expect(result?.response).toContain('📊 **서버 현황 요약**');
    expect(result?.response).toContain('전체 3대');
    expect(result?.response).not.toContain('잘못된 요약');
  });

  it('uses current-state deterministic summary when summary prompt has no tool results', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '모델만으로 만든 요약',
        steps: [],
      })
    );

    const result = await executeForcedRouting(
      '현재 모든 서버의 상태를 요약해줘',
      'Metrics Query Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource()
    );

    expect(result?.response).toContain('📊 **서버 현황 요약**');
    expect(result?.response).not.toContain('모델만으로 만든 요약');
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
  });

  it('passes runtime domain id to forced-routing data source context', async () => {
    const snapshot = vi.fn(async () => ({
      timestamp: '2026-05-06T00:00:00+09:00',
      data: {
        servers: [
          { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
        ],
      },
    }));

    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({ text: '모델 요약', steps: [] })
    );

    const result = await executeForcedRouting(
      '현재 모든 서버의 상태를 요약해줘',
      'Metrics Query Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      { snapshot, history: vi.fn(async () => []) },
      'sample-support'
    );

    expect(result?.response).toContain('📊 **서버 현황 요약**');
    expect(snapshot.mock.calls[0]?.[0]).toMatchObject({
      domainId: 'sample-support',
      message: '현재 모든 서버의 상태를 요약해줘',
    });
  });

  it('uses summarization fallback for non-summary empty responses in forced routing', async () => {
    mockGenerateTextWithRetry
      .mockResolvedValueOnce(
        createRetryResult({
          text: '',
          steps: [
            {
              toolCalls: [{ toolName: 'getServerMetrics' }],
              toolResults: [
                {
                  toolName: 'getServerMetrics',
                  result: {
                    servers: [
                      {
                        id: 'api-01',
                        status: 'warning',
                        cpu: 88,
                        memory: 62,
                        disk: 40,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createRetryResult({
          text: 'CPU 사용률이 가장 높은 서버는 api-01이며 즉시 점검이 필요합니다.',
        })
      );

    const result = await executeForcedRouting(
      '최근 에러 로그 보여줘',
      'Metrics Query Agent',
      Date.now()
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('api-01');
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(2);
    expect(mockGenerateTextWithRetry.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        maxOutputTokens: 768,
      })
    );
    expect(mockGenerateTextWithRetry.mock.calls[1]?.[1]).toEqual([
      'mistral',
      'zai',
      'groq',
      'cerebras',
    ]);
    expect(mockGenerateTextWithRetry.mock.calls[1]?.[2]).toEqual({
      timeoutMs: 10000,
    });
  });

  it('enriches forced-routing responses from collected tool results without another LLM call', async () => {
    mockEvaluateAgentResponseQuality.mockImplementation(
      (_agentName: string, text: string) => ({
        responseChars: text.length,
        formatCompliance: true,
        qualityFlags: text.includes('참고 수치')
          ? []
          : ['MISSING_METRIC_EVIDENCE', 'MISSING_SERVER_REFERENCE'],
        latencyTier: 'fast',
      })
    );
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: 'api-01 상태를 확인했습니다.',
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    {
                      name: 'api-01',
                      status: 'warning',
                      cpu: 87,
                      memory: 62,
                      disk: 44,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const result = await executeForcedRouting(
      'api-01 상태를 근거와 함께 설명해줘',
      'Metrics Query Agent',
      Date.now()
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('api-01 상태를 확인했습니다.');
    expect(result?.response).toContain('📊 **참고 수치**: api-01: CPU 87%');
    expect(result?.response).toContain('🖥️ **관련 서버**: api-01');
    expect(result?.metadata.qualityFlags).toEqual([]);
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
    expect(mockEvaluateAgentResponseQuality).toHaveBeenCalledTimes(2);
  });

  it('records provider attempts and fallback reason for Langfuse diagnostics', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: 'fallback 응답',
        usedFallback: true,
        attempts: [
          {
            provider: 'groq',
            modelId: 'groq-model',
            attempt: 1,
            durationMs: 120,
            error: 'rate limit exceeded: 429',
          },
          {
            provider: 'cerebras',
            modelId: 'llama3.1-8b',
            attempt: 1,
            durationMs: 80,
          },
        ],
      })
    );

    const result = await executeForcedRouting(
      '최근 에러 로그 보여줘',
      'Metrics Query Agent',
      Date.now()
    );

    expect(result?.metadata.usedFallback).toBe(true);
    expect(result?.metadata.fallbackReason).toBe('rate_limit');
    expect(result?.metadata.providerAttempts).toEqual([
      {
        provider: 'groq',
        modelId: 'groq-model',
        attempt: 1,
        durationMs: 120,
        error: 'rate limit exceeded: 429',
      },
      {
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        attempt: 1,
        durationMs: 80,
      },
    ]);
  });

  it('injects distilled context summary into forced-routing prompt', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '요약 완료',
      })
    );

    await executeForcedRouting(
      'CPU 높은 서버 찾아줘',
      'Metrics Query Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      '이전 분석: api-01 CPU 급등, 원인 미확정'
    );

    const firstCall = mockGenerateTextWithRetry.mock.calls[0]?.[0];
    expect(firstCall.messages[1].content).toContain('[세션 컨텍스트 요약]');
    expect(firstCall.messages[1].content).toContain('api-01 CPU 급등');
  });

  it('forces searchKnowledgeBase toolChoice for advisor topology queries', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '토폴로지 요약 완료',
      })
    );

    await executeForcedRouting(
      '현재 인프라 토폴로지 알려줘. 관련된 운영 가이드도 연결해줘',
      'Advisor Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource(Array.from({ length: 18 }, (_, index) => `server-${index + 1}`))
    );

    const firstCall = mockGenerateTextWithRetry.mock.calls[0]?.[0];
    expect(firstCall.toolChoice).toEqual({
      type: 'tool',
      toolName: 'searchKnowledgeBase',
    });
  });

  it('passes long-context capability requirements for forced-routing quality agents', async () => {
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '디스크 점검 명령어 요약',
      })
    );

    await executeForcedRouting(
      '디스크 사용률이 높은 서버를 위한 해결 방법과 확인 명령어 2개만 추천해줘',
      'Advisor Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource(Array.from({ length: 18 }, (_, index) => `server-${index + 1}`))
    );

    const firstCall = mockGenerateTextWithRetry.mock.calls[0];
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        requiredCapabilities: {
          requireToolCalling: true,
          minContextTokens: 32_000,
        },
      })
    );
    expect(firstCall?.[1]).toEqual(['mistral', 'zai', 'groq', 'cerebras']);
  });

  it('uses structured topology state before RAG documents for server count, role, AZ, and status questions', async () => {
    const result = await executeForcedRouting(
      '현재 인프라 토폴로지의 서버 수와 role/AZ/status 알려줘',
      'Advisor Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource(Array.from({ length: 18 }, (_, index) => `server-${index + 1}`))
    );

    expect(result?.success).toBe(true);
    expect(result?.metadata.provider).toBe('deterministic');
    expect(result?.metadata.modelId).toBe('structured-topology-state');
    expect(result?.toolsCalled).toEqual([
      'structuredTopologyLookup',
      'finalAnswer',
    ]);
    expect(result?.response).toContain('총 서버 수: 18대');
    expect(result?.response).toContain('역할 분포');
    expect(result?.response).toContain('AZ 분포');
    expect(result?.response).toContain('현재 상태 요약');
    expect(result?.response).toContain('RAG 문서가 아니라 구조화된 OTel resource catalog');
    expect(result?.ragSources).toBeUndefined();
    expect(result?.evidenceCards?.[0]).toMatchObject({
      id: 'structured-topology-current-state',
      category: 'structured-topology',
      reason: 'structured-evidence:otel-resource-catalog+domain-data-source',
    });
    expect(result?.metadata.retrieval).toEqual(
      expect.objectContaining({
        retrievalEnabled: true,
        retrievalUsed: false,
        suppressedReason: 'not_needed',
      })
    );
    expect(mockSearchKnowledgeBaseExecute).not.toHaveBeenCalled();
    expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
  });

  it('invalidates the resource catalog cache when a higher-priority SSOT catalog appears', async () => {
    const originalCwd = process.cwd();
    const tempDir = mkdtempSync(join(tmpdir(), 'om-resource-catalog-'));
    const query = '현재 인프라 토폴로지의 서버 수와 role/AZ/status 알려줘';

    try {
      const generatedCatalogDir = join(tempDir, 'data/otel-data');
      mkdirSync(generatedCatalogDir, { recursive: true });
      writeFileSync(
        join(generatedCatalogDir, 'resource-catalog.json'),
        JSON.stringify(createResourceCatalog(['generated-01'])),
        'utf-8'
      );

      process.chdir(tempDir);

      const generatedResult = await executeForcedRouting(
        query,
        'Advisor Agent',
        Date.now(),
        true,
        true,
        undefined,
        undefined,
        undefined,
        createTestDataSource(['generated-01'])
      );

      expect(generatedResult?.response).toContain('총 서버 수: 1대');

      const ssotCatalogDir = join(tempDir, 'public/data/otel-data');
      mkdirSync(ssotCatalogDir, { recursive: true });
      writeFileSync(
        join(ssotCatalogDir, 'resource-catalog.json'),
        JSON.stringify(createResourceCatalog(['ssot-01', 'ssot-02'])),
        'utf-8'
      );

      const ssotResult = await executeForcedRouting(
        query,
        'Advisor Agent',
        Date.now(),
        true,
        true,
        undefined,
        undefined,
        undefined,
        createTestDataSource(['ssot-01', 'ssot-02'])
      );

      expect(ssotResult?.response).toContain('총 서버 수: 2대');
      expect(ssotResult?.response).toContain('- app: ssot-02');
      expect(ssotResult?.response).toContain('- web: ssot-01');
    } finally {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses direct KB deterministic path for advisor topology queries when KB succeeds', async () => {
    mockSearchKnowledgeBaseExecute.mockResolvedValueOnce({
      success: true,
      totalFound: 2,
      results: [
        {
          id: 'kb-1',
          title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
          content: '총 18대 서버 기준으로 LB->WEB->APP->DB 경로를 사용합니다.',
          similarity: 0.91,
          sourceType: 'knowledge',
          category: 'architecture',
        },
        {
          id: 'kb-2',
          title: '현재 인프라 배치/운영 검증 스냅샷',
          content: '운영 구간에서 트래픽 분산과 장애 대응 절차를 정의합니다.',
          similarity: 0.83,
          sourceType: 'runbook',
          category: 'architecture',
        },
      ],
      evidenceCards: [
        {
          id: 'kb-1',
          title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
          summary: '총 18대 서버 기준으로 LB->WEB->APP->DB 경로를 사용합니다.',
          sourceType: 'knowledge',
          score: 0.91,
          category: 'architecture',
        },
      ],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
    });

    const result = await executeForcedRouting(
      '현재 인프라 토폴로지 알려줘',
      'Advisor Agent',
      Date.now(),
      true,
      true
    );

    expect(result?.success).toBe(true);
    expect(result?.metadata.provider).toBe('deterministic');
    expect(result?.toolsCalled).toEqual(['searchKnowledgeBase', 'finalAnswer']);
    expect(result?.response).toContain('해결/권장 조치');
    expect(result?.response).toContain('`getServerMetrics`');
    expect(result?.response).toContain('운영 지식');
    expect(result?.response).not.toContain('vector');
    expect(result?.response).not.toContain('graph');
    expect(result?.evidenceCards).toHaveLength(1);
    expect(result?.metadata.retrieval).toEqual(
      expect.objectContaining({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
      })
    );
    expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
    expect(mockSearchKnowledgeBaseExecute).toHaveBeenCalled();
    const kbArgs = mockSearchKnowledgeBaseExecute.mock.calls[0]?.[0];
    expect(kbArgs).not.toHaveProperty('useGraphRAG');
  });

  it('refuses internal document path disclosure for user mode before inferring paths', async () => {
    mockSearchKnowledgeBaseExecute.mockResolvedValueOnce({
      success: true,
      totalFound: 0,
      results: [],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        evidenceCount: 0,
        webUsed: false,
        suppressedReason: 'no_results',
      },
    });

    const result = await executeForcedRouting(
      'Pre-generated OTel 데이터 SSOT 파일 경로와 데이터 로더 경로 알려줘',
      'Advisor Agent',
      Date.now(),
      true,
      true
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('일반 사용자 모드');
    expect(result?.response).toContain('구현 파일 경로');
    expect(result?.response).not.toContain('/path/to');
    expect(result?.toolsCalled).toEqual(['searchKnowledgeBase']);
    expect(result?.metadata.provider).toBe('deterministic');
    expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
  });

  it('refuses rephrased internal implementation file questions in user mode', async () => {
    mockSearchKnowledgeBaseExecute.mockResolvedValueOnce({
      success: true,
      totalFound: 1,
      results: [
        {
          id: 'kb-otel-ssot',
          title: 'OpenManager OTel SSOT',
          content:
            'OTel SSOT는 public/data/otel-data/resource-catalog.json 파일과 src/data/otel-data/index.ts 로더에서 정의됩니다.',
          similarity: 0.93,
          sourceType: 'knowledge',
          category: 'architecture',
        },
      ],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
        webUsed: false,
      },
    });

    const result = await executeForcedRouting(
      'OpenManager OTel SSOT는 어느 파일에 정의돼?',
      'Advisor Agent',
      Date.now(),
      true,
      true
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('일반 사용자 모드');
    expect(result?.response).not.toContain('public/data/otel-data');
    expect(result?.response).not.toContain('src/data/otel-data');
    expect(result?.toolsCalled).toEqual(['searchKnowledgeBase', 'finalAnswer']);
    expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
  });

  it('keeps no-evidence internal path answers available in developer disclosure mode', async () => {
    mockSearchKnowledgeBaseExecute.mockResolvedValueOnce({
      success: true,
      totalFound: 0,
      results: [],
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        evidenceCount: 0,
        webUsed: false,
        suppressedReason: 'no_results',
      },
    });

    const result = await executeForcedRouting(
      'Pre-generated OTel 데이터 SSOT 파일 경로와 데이터 로더 경로 알려줘',
      'Advisor Agent',
      Date.now(),
      true,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'developer'
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('내부 근거를 찾지 못했습니다');
    expect(result?.response).toContain('경로가 0건');
    expect(result?.response).not.toContain('/path/to');
    expect(result?.toolsCalled).toEqual(['searchKnowledgeBase']);
    expect(result?.metadata.provider).toBe('deterministic');
    expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
  });

  it('propagates evidence cards from forced-routing knowledge tool results', async () => {
    mockSearchKnowledgeBaseExecute.mockResolvedValueOnce({
      success: true,
      totalFound: 0,
      results: [],
    });
    mockGenerateTextWithRetry.mockResolvedValueOnce(
      createRetryResult({
        text: '토폴로지 근거 요약',
        steps: [
          {
            toolCalls: [{ toolName: 'searchKnowledgeBase' }],
            toolResults: [
              {
                toolName: 'searchKnowledgeBase',
                result: {
                  success: true,
                  results: [
                    {
                      id: 'kb-1',
                      title: '현재 인프라 토폴로지',
                      content: '총 18대 서버 기준 토폴로지 문서',
                      similarity: 0.91,
                      sourceType: 'knowledge',
                      category: 'architecture',
                    },
                  ],
                  evidenceCards: [
                    {
                      id: 'kb-1',
                      title: '현재 인프라 토폴로지',
                      summary: '총 18대 서버 기준 토폴로지 문서',
                      sourceType: 'knowledge',
                      score: 0.91,
                      category: 'architecture',
                    },
                  ],
                  retrieval: {
                    retrievalEnabled: true,
                    retrievalUsed: true,
                    retrievalMode: 'lite',
                    evidenceCount: 1,
                    webUsed: false,
                  },
                },
              },
            ],
          },
        ],
      })
    );

    const result = await executeForcedRouting(
      '현재 인프라 토폴로지 알려줘',
      'Advisor Agent',
      Date.now(),
      true,
      true
    );

    expect(result?.success).toBe(true);
    expect(result?.toolsCalled).toContain('searchKnowledgeBase');
    expect(result?.ragSources).toBeUndefined();
    expect(result?.evidenceCards).toHaveLength(1);
    expect(result?.metadata.retrieval).toEqual(
      expect.objectContaining({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
      })
    );
  });
});

describe('provider order policy', () => {
  it('splits text agent provider order by workload group', () => {
    expect(getAgentProviderOrder('Metrics Query Agent')).toEqual([
      'groq',
      'zai',
      'mistral',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Analyst Agent')).toEqual([
      'mistral',
      'groq',
      'zai',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Reporter Agent')).toEqual([
      'zai',
      'mistral',
      'groq',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Advisor Agent')).toEqual([
      'mistral',
      'zai',
      'groq',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Unknown Agent')).toEqual([
      'groq',
      'zai',
      'mistral',
      'cerebras',
    ]);
  });

  it('keeps Orchestrator structured-output provider order as documented', () => {
    expect(ORCHESTRATOR_PROVIDER_ORDER).toEqual([
      'cerebras',
      'mistral',
      'zai',
      'groq',
    ]);
  });
});

describe('executeWithAgentFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates retrieval evidence metadata from agent tool results', async () => {
    vi.mocked(AgentFactory.create).mockReturnValue({
      getName: () => 'Advisor Agent',
      run: vi.fn().mockResolvedValue({
        success: true,
        text: 'Redis 연결 실패는 cache 계층 로그와 런북을 함께 확인해야 합니다.',
        toolsCalled: ['searchKnowledgeBase'],
        evidenceCards: [
          {
            id: 'kb-redis-connection',
            title: 'Redis connection timeout runbook',
            summary: 'Redis connection timeout troubleshooting guide',
            sourceType: 'runbook',
            score: 0.88,
            category: 'troubleshooting',
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        metadata: {
          provider: 'groq',
          modelId: 'groq-model',
          durationMs: 20,
          steps: 2,
          responseChars: 38,
          formatCompliance: true,
          qualityFlags: [],
          latencyTier: 'fast',
          retrieval: {
            retrievalEnabled: true,
            retrievalUsed: true,
            retrievalMode: 'lite',
            evidenceCount: 1,
            webUsed: false,
          },
        },
      }),
    } as unknown as ReturnType<typeof AgentFactory.create>);

    const result = await executeWithAgentFactory(
      'redis 연결 실패 원인 알려줘',
      'advisor',
      Date.now(),
      true,
      true
    );

    expect(result?.success).toBe(true);
    expect(result?.toolsCalled).toEqual(['searchKnowledgeBase']);
    expect(result?.ragSources).toBeUndefined();
    expect(result?.evidenceCards).toHaveLength(1);
    expect(result?.metadata.retrieval).toEqual(
      expect.objectContaining({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
      })
    );
  });
});
