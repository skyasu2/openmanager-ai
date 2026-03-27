import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateTextWithRetry } = vi.hoisted(() => ({
  mockGenerateTextWithRetry: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: vi.fn(() => () => false),
}));

vi.mock('../../resilience/retry-with-fallback', () => ({
  generateTextWithRetry: mockGenerateTextWithRetry,
}));

vi.mock('../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../../lib/ai-sdk-utils', () => ({
  extractToolResultOutput: vi.fn(
    (toolResult: { result?: unknown; output?: unknown }) =>
      toolResult.result ?? toolResult.output
  ),
}));

vi.mock('./config', () => ({
  AGENT_CONFIGS: {
    'NLQ Agent': {
      name: 'NLQ Agent',
      instructions: 'Test instructions',
      tools: {
        getServerMetrics: { execute: vi.fn() },
        finalAnswer: { execute: vi.fn() },
      },
      getModel: vi.fn(() => ({ provider: 'cerebras' })),
    },
  },
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
  evaluateAgentResponseQuality: vi.fn((_agentName: string, text: string) => ({
    responseChars: text.length,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { executeForcedRouting } from './orchestrator-routing';

function createRetryResult(options: {
  text?: string;
  usedFallback?: boolean;
  steps?: Array<{
    toolCalls?: Array<{ toolName: string }>;
    toolResults?: Array<{ toolName: string; result?: unknown; output?: unknown }>;
  }>;
}) {
  return {
    success: true,
    provider: 'cerebras',
    modelId: 'cerebras-model',
    usedFallback: options.usedFallback ?? false,
    totalDurationMs: 10,
    attempts: [
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

describe('executeForcedRouting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses deterministic fallback for empty NLQ summary responses without a second retry call', async () => {
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
                    { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
                    { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
                    { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
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
      'NLQ Agent',
      Date.now()
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('📊 **서버 현황 요약**');
    expect(result?.response).toContain('api-01');
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
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
                      { id: 'api-01', status: 'warning', cpu: 88, memory: 62, disk: 40 },
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
      'CPU 높은 서버 찾아줘',
      'NLQ Agent',
      Date.now()
    );

    expect(result?.success).toBe(true);
    expect(result?.response).toContain('api-01');
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(2);
  });
});
