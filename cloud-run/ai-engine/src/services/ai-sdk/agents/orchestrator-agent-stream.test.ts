import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText, mockStreamText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: vi.fn(() => () => false),
}));

vi.mock('../../../lib/ai-sdk-utils', () => ({
  buildMultimodalContent: vi.fn((query: string) => query),
  extractToolResultOutput: vi.fn(
    (toolResult: { result?: unknown; output?: unknown }) =>
      toolResult.result ?? toolResult.output
  ),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../observability/langfuse', () => ({
  createTimeoutSpan: vi.fn(() => ({ complete: vi.fn() })),
  logTimeoutEvent: vi.fn(),
}));

vi.mock('../../resilience/circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
    execute: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('./orchestrator-routing', () => ({
  getAgentConfig: vi.fn(() => ({
    instructions: 'Test instructions',
    tools: {
      getServerMetrics: { execute: vi.fn() },
      finalAnswer: { execute: vi.fn() },
    },
  })),
  getAgentProviderOrder: vi.fn(() => ['cerebras', 'groq']),
  executeReporterWithPipeline: vi.fn(),
}));

vi.mock('./orchestrator-context', () => ({
  saveAgentFindingsToContext: vi.fn(() => Promise.resolve()),
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: vi.fn(
    (_agentName: string, providers: string[]) => ({
      model: { provider: providers[0] },
      provider: providers[0],
      modelId: `${providers[0]}-model`,
    })
  ),
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

vi.mock('./orchestrator-decomposition', () => ({
  streamTextInChunks: vi.fn(),
}));

import { executeAgentStream } from './orchestrator-agent-stream';

function createStreamResult(options: {
  chunks?: string[];
  steps?: Array<{
    finishReason?: string;
    toolCalls?: Array<{ toolName: string }>;
    toolResults?: Array<{ toolName: string; result?: unknown; output?: unknown }>;
  }>;
}) {
  return {
    textStream: (async function* () {
      for (const chunk of options.chunks ?? []) {
        yield chunk;
      }
    })(),
    steps: Promise.resolve(
      (options.steps ?? []).map((step) => ({
        finishReason: step.finishReason ?? 'stop',
        toolCalls: step.toolCalls ?? [],
        toolResults: step.toolResults ?? [],
      }))
    ),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
  };
}

async function collectEvents(query: string) {
  const events: Array<{ type: string; data: unknown }> = [];
  for await (const event of executeAgentStream(
    query,
    'NLQ Agent',
    Date.now(),
    'test-session',
    true,
    true
  )) {
    events.push(event);
  }
  return events;
}

describe('executeAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: '' });
  });

  it('uses deterministic fallback for starter summary prompts without extra LLM summarization', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['   '],
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

    const events = await collectEvents('현재 모든 서버의 상태를 요약해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('📊 **서버 현황 요약**');
    expect(textPayload).toContain('api-01');
    expect(mockGenerateText).not.toHaveBeenCalled();

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect((doneEvent?.data as { success: boolean }).success).toBe(true);
  });

  it('retries the next provider when the first provider returns no output', async () => {
    mockStreamText.mockImplementation(
      ({ model }: { model: { provider: string } }) => {
        if (model.provider === 'cerebras') {
          throw new Error('No output generated');
        }

        return createStreamResult({
          chunks: ['정상 응답'],
          steps: [
            {
              toolCalls: [{ toolName: 'finalAnswer' }],
              toolResults: [
                {
                  toolName: 'finalAnswer',
                  result: { answer: '정상 응답' },
                },
              ],
            },
          ],
        });
      }
    );

    const events = await collectEvents('CPU 사용률 알려줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('정상 응답');
    expect(mockStreamText).toHaveBeenCalledTimes(2);

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect((doneEvent?.data as { success: boolean }).success).toBe(true);
  });
});
