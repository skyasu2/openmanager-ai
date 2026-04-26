import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGenerateObject = vi.fn();
const mockGenerateText = vi.fn();
const mockSelectTextModel = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: (...args: unknown[]) => mockSelectTextModel(...args),
}));

import { generateObjectWithFallback } from './orchestrator-object-fallback';
import { __resetProviderRetryBudgetForTests } from '../../resilience/provider-fallback-control';

const testSchema = z.object({
  selectedAgent: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

type TestSchema = z.infer<typeof testSchema>;

const baseOptions = {
  model: {} as Parameters<typeof mockGenerateObject>[0]['model'],
  schema: testSchema,
  system: 'Test system prompt',
  prompt: 'Test prompt',
  temperature: 0.1,
  operation: 'test-operation',
  provider: 'cerebras' as const,
  modelId: 'gpt-oss-120b',
  providerFallback: {
    agentLabel: 'Orchestrator',
    providerOrder: ['cerebras', 'groq', 'mistral'] as const,
    cbPrefix: 'orchestrator',
  },
};

describe('generateObjectWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    __resetProviderRetryBudgetForTests();
    mockSelectTextModel.mockReset();
  });

  it('should return object from generateObject on success', async () => {
    const expected: TestSchema = {
      selectedAgent: 'NLQ Agent',
      confidence: 0.95,
      reasoning: 'Simple query',
    };

    mockGenerateObject.mockResolvedValue({
      object: expected,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generateObjectWithFallback(baseOptions);

    expect(result.object).toEqual(expected);
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should fall back to text parsing on schema error', async () => {
    mockGenerateObject.mockRejectedValue(
      new Error('json_schema: invalid format')
    );

    const fallbackJson = JSON.stringify({
      selectedAgent: 'Analyst Agent',
      confidence: 0.8,
      reasoning: 'Fallback parse',
    });

    mockGenerateText.mockResolvedValue({
      text: fallbackJson,
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    const result = await generateObjectWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Analyst Agent');
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('should handle code-fenced JSON in fallback text', async () => {
    mockGenerateObject.mockRejectedValue(
      new Error('failed to parse response')
    );

    const fencedResponse = `\`\`\`json
{
  "selectedAgent": "Reporter Agent",
  "confidence": 0.7,
  "reasoning": "Report needed"
}
\`\`\``;

    mockGenerateText.mockResolvedValue({
      text: fencedResponse,
      usage: { inputTokens: 150, outputTokens: 60, totalTokens: 210 },
    });

    const result = await generateObjectWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Reporter Agent');
  });

  it('should rethrow non-schema errors without fallback', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API key invalid'));

    await expect(generateObjectWithFallback(baseOptions)).rejects.toThrow(
      'API key invalid'
    );

    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should fall back to next provider on model access error', async () => {
    const primaryModel = { name: 'primary' } as Parameters<typeof mockGenerateObject>[0]['model'];
    const fallbackModel = { name: 'fallback' } as Parameters<typeof mockGenerateObject>[0]['model'];
    const expected: TestSchema = {
      selectedAgent: 'Analyst Agent',
      confidence: 0.88,
      reasoning: 'Fallback provider succeeded',
    };

    mockGenerateObject.mockImplementation(async ({ model }: { model: unknown }) => {
      if (model === primaryModel) {
        throw new Error('Model gpt-oss-120b does not exist or you do not have access to it.');
      }

      return {
        object: expected,
        usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 },
      };
    });

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateObjectWithFallback({
      ...baseOptions,
      model: primaryModel,
    });

    expect(result.object).toEqual(expected);
    expect(mockSelectTextModel).toHaveBeenCalledWith(
      'Orchestrator',
      ['cerebras', 'groq', 'mistral'],
      {
        excludeProviders: ['cerebras'],
        cbPrefix: 'orchestrator',
        requiredCapabilities: { requireStructuredOutput: true },
      }
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should rethrow provider error when no fallback model is available', async () => {
    mockGenerateObject.mockRejectedValue(
      new Error('Model gpt-oss-120b does not exist or you do not have access to it.')
    );
    mockSelectTextModel.mockReturnValue(null);

    await expect(generateObjectWithFallback(baseOptions)).rejects.toThrow(
      'Model gpt-oss-120b does not exist or you do not have access to it.'
    );
  });

  it('should fall back to the next provider when text fallback fails with a provider error', async () => {
    const primaryModel =
      {} as Parameters<typeof mockGenerateObject>[0]['model'];
    const fallbackModel =
      {} as Parameters<typeof mockGenerateObject>[0]['model'];
    const expected: TestSchema = {
      selectedAgent: 'Reporter Agent',
      confidence: 0.82,
      reasoning: 'Recovered on fallback provider',
    };

    mockGenerateObject.mockImplementation(async ({ model }: { model: unknown }) => {
      if (model === primaryModel) {
        throw new Error('response format not supported');
      }

      return {
        object: expected,
        usage: { inputTokens: 90, outputTokens: 35, totalTokens: 125 },
      };
    });

    mockGenerateText.mockImplementation(async ({ model }: { model: unknown }) => {
      if (model === primaryModel) {
        const error = new Error('rate limit exceeded');
        (error as Error & { status?: number }).status = 429;
        throw error;
      }

      return {
        text: JSON.stringify(expected),
        usage: { inputTokens: 110, outputTokens: 45, totalTokens: 155 },
      };
    });

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateObjectWithFallback({
      ...baseOptions,
      model: primaryModel,
    });

    expect(result.object).toEqual(expected);
    expect(mockSelectTextModel).toHaveBeenCalledWith(
      'Orchestrator',
      ['cerebras', 'groq', 'mistral'],
      {
        excludeProviders: ['cerebras'],
        cbPrefix: 'orchestrator',
        requiredCapabilities: { requireStructuredOutput: true },
      }
    );
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('should fall back to the next provider when schema fallback still returns invalid JSON', async () => {
    const primaryModel =
      {} as Parameters<typeof mockGenerateObject>[0]['model'];
    const fallbackModel =
      {} as Parameters<typeof mockGenerateObject>[0]['model'];
    const expected: TestSchema = {
      selectedAgent: 'Advisor Agent',
      confidence: 0.77,
      reasoning: 'Recovered on second provider after invalid JSON fallback',
    };

    mockGenerateObject.mockImplementation(async ({ model }: { model: unknown }) => {
      if (model === primaryModel) {
        throw new Error('response format not supported');
      }

      return {
        object: expected,
        usage: { inputTokens: 95, outputTokens: 30, totalTokens: 125 },
      };
    });

    mockGenerateText.mockResolvedValue({
      text: 'not valid json at all',
      usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
    });

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateObjectWithFallback({
      ...baseOptions,
      model: primaryModel,
    });

    expect(result.object).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('should throw combined error when fallback text also fails parsing', async () => {
    const originalError = new Error('Schema output validation failed: bad data');
    mockGenerateObject.mockRejectedValue(originalError);

    mockGenerateText.mockResolvedValue({
      text: 'not valid json at all',
      usage: {},
    });

    await expect(generateObjectWithFallback(baseOptions)).rejects.toThrow(
      /Structured output failed and text fallback also failed/
    );
  });

  it('should validate generateObject result against schema', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { selectedAgent: 'NLQ Agent' },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const fallbackJson = JSON.stringify({
      selectedAgent: 'NLQ Agent',
      confidence: 0.9,
      reasoning: 'Recovered via fallback',
    });

    mockGenerateText.mockResolvedValue({
      text: fallbackJson,
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    const result = await generateObjectWithFallback(baseOptions);

    expect(result.object.reasoning).toBe('Recovered via fallback');
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('should handle missing usage gracefully', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        selectedAgent: 'Advisor Agent',
        confidence: 0.85,
        reasoning: 'Advice needed',
      },
      usage: undefined,
    });

    const result = await generateObjectWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Advisor Agent');
    expect(result.usage).toBeUndefined();
  });

  it('should include fallbackPromptExtra in text fallback prompt', async () => {
    mockGenerateObject.mockRejectedValue(
      new Error('response format not supported')
    );

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        selectedAgent: 'NLQ Agent',
        confidence: 0.6,
        reasoning: 'Extra context used',
      }),
      usage: {},
    });

    await generateObjectWithFallback({
      ...baseOptions,
      fallbackPromptExtra: '에이전트는 5개입니다.',
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain('에이전트는 5개입니다.');
  });

  it('waits before switching providers after structured-output provider failure', async () => {
    vi.useFakeTimers();

    mockGenerateObject
      .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
      .mockResolvedValueOnce({
        object: {
          selectedAgent: 'Analyst Agent',
          confidence: 0.91,
          reasoning: 'Fallback after provider delay',
        },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });

    mockSelectTextModel.mockReturnValue({
      model: { provider: 'groq' },
      provider: 'groq',
      modelId: 'groq-model',
    });

    const promise = generateObjectWithFallback({
      ...baseOptions,
      operation: 'routing-delay-test',
      providerFallbackControl: {
        fallbackDelayMs: 10,
        fallbackJitterMs: 0,
      },
    });

    await Promise.resolve();
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(9);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    const result = await promise;
    expect(result.object.selectedAgent).toBe('Analyst Agent');
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });

  it('fails fast when retry budget blocks structured-output provider fallback', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('rate limit exceeded: 429'));
    mockSelectTextModel.mockReturnValue({
      model: { provider: 'groq' },
      provider: 'groq',
      modelId: 'groq-model',
    });

    await expect(
      generateObjectWithFallback({
        ...baseOptions,
        operation: 'routing-budget-test',
        providerFallbackControl: {
          fallbackDelayMs: 0,
          fallbackJitterMs: 0,
          retryBudgetPerMinute: 0,
        },
      })
    ).rejects.toThrow('rate limit exceeded: 429');

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });

  it('applies the same fallback delay when text fallback parsing fails', async () => {
    vi.useFakeTimers();

    const expected: TestSchema = {
      selectedAgent: 'Reporter Agent',
      confidence: 0.82,
      reasoning: 'Recovered after delayed text fallback failure',
    };

    mockGenerateObject
      .mockRejectedValueOnce(new Error('response format not supported'))
      .mockResolvedValueOnce({
        object: expected,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
    mockGenerateText.mockResolvedValueOnce({
      text: 'not-json',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    mockSelectTextModel.mockReturnValue({
      model: { provider: 'groq' },
      provider: 'groq',
      modelId: 'groq-model',
    });

    const promise = generateObjectWithFallback({
      ...baseOptions,
      operation: 'routing-text-fallback-test',
      providerFallbackControl: {
        fallbackDelayMs: 15,
        fallbackJitterMs: 0,
      },
    });

    await Promise.resolve();
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    const result = await promise;
    expect(result.object).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });
});
