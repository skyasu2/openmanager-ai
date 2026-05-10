import type { LanguageModel } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGenerateText = vi.fn();
const mockOutputObject = vi.fn((config: unknown) => ({
  kind: 'object-output',
  config,
}));
const mockSelectTextModel = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: {
    object: (...args: unknown[]) => mockOutputObject(...args),
  },
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: (...args: unknown[]) => mockSelectTextModel(...args),
}));

import { __resetProviderRetryBudgetForTests } from '../../resilience/provider-fallback-control';
import { generateStructuredOutputWithFallback } from './orchestrator-object-fallback';

const testSchema = z.object({
  selectedAgent: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

type TestSchema = z.infer<typeof testSchema>;

interface GenerateTextCall {
  model?: unknown;
  output?: unknown;
  prompt?: string;
}

function languageModel(name: string): LanguageModel {
  return { name } as unknown as LanguageModel;
}

function structuredCalls() {
  return mockGenerateText.mock.calls.filter(([args]) =>
    Boolean((args as GenerateTextCall).output)
  );
}

function textFallbackCalls() {
  return mockGenerateText.mock.calls.filter(
    ([args]) => !Boolean((args as GenerateTextCall).output)
  );
}

const baseOptions = {
  model: languageModel('primary'),
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

describe('generateStructuredOutputWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    __resetProviderRetryBudgetForTests();
    mockSelectTextModel.mockReset();
    mockOutputObject.mockImplementation((config: unknown) => ({
      kind: 'object-output',
      config,
    }));
  });

  it('returns object from generateText Output.object on success', async () => {
    const expected: TestSchema = {
      selectedAgent: 'NLQ Agent',
      confidence: 0.95,
      reasoning: 'Simple query',
    };

    mockGenerateText.mockResolvedValue({
      output: expected,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generateStructuredOutputWithFallback(baseOptions);

    expect(result.object).toEqual(expected);
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(structuredCalls()).toHaveLength(1);
    expect(textFallbackCalls()).toHaveLength(0);
    expect(mockOutputObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: testSchema,
        name: 'structured_output',
      })
    );
  });

  it('falls back to text parsing on structured output schema error', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('json_schema: invalid format'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          selectedAgent: 'Analyst Agent',
          confidence: 0.8,
          reasoning: 'Fallback parse',
        }),
        usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
      });

    const result = await generateStructuredOutputWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Analyst Agent');
    expect(structuredCalls()).toHaveLength(1);
    expect(textFallbackCalls()).toHaveLength(1);
  });

  it('handles code-fenced JSON in fallback text', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('failed to parse response'))
      .mockResolvedValueOnce({
        text: `\`\`\`json
{
  "selectedAgent": "Reporter Agent",
  "confidence": 0.7,
  "reasoning": "Report needed"
}
\`\`\``,
        usage: { inputTokens: 150, outputTokens: 60, totalTokens: 210 },
      });

    const result = await generateStructuredOutputWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Reporter Agent');
  });

  it('rethrows non-schema errors without text fallback when provider fallback is unavailable', async () => {
    mockGenerateText.mockRejectedValue(new Error('API key invalid'));

    await expect(
      generateStructuredOutputWithFallback({
        ...baseOptions,
        providerFallback: undefined,
      })
    ).rejects.toThrow('API key invalid');

    expect(structuredCalls()).toHaveLength(1);
    expect(textFallbackCalls()).toHaveLength(0);
  });

  it('falls back to next provider on model access error', async () => {
    const primaryModel = languageModel('primary');
    const fallbackModel = languageModel('fallback');
    const expected: TestSchema = {
      selectedAgent: 'Analyst Agent',
      confidence: 0.88,
      reasoning: 'Fallback provider succeeded',
    };

    mockGenerateText.mockImplementation(
      async ({ model }: { model: unknown }) => {
        if (model === primaryModel) {
          throw new Error(
            'Model gpt-oss-120b does not exist or you do not have access to it.'
          );
        }

        return {
          output: expected,
          usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 },
        };
      }
    );

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateStructuredOutputWithFallback({
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
    expect(structuredCalls()).toHaveLength(2);
    expect(textFallbackCalls()).toHaveLength(0);
  });

  it('rethrows provider error when no fallback model is available', async () => {
    mockGenerateText.mockRejectedValue(
      new Error(
        'Model gpt-oss-120b does not exist or you do not have access to it.'
      )
    );
    mockSelectTextModel.mockReturnValue(null);

    await expect(
      generateStructuredOutputWithFallback(baseOptions)
    ).rejects.toThrow(
      'Model gpt-oss-120b does not exist or you do not have access to it.'
    );
  });

  it('falls back to the next provider when text fallback fails with a provider error', async () => {
    const primaryModel = languageModel('primary');
    const fallbackModel = languageModel('fallback');
    const expected: TestSchema = {
      selectedAgent: 'Reporter Agent',
      confidence: 0.82,
      reasoning: 'Recovered on fallback provider',
    };

    mockGenerateText.mockImplementation(
      async ({ model, output }: { model: unknown; output?: unknown }) => {
        if (output) {
          if (model === primaryModel) {
            throw new Error('response format not supported');
          }
          return {
            output: expected,
            usage: { inputTokens: 90, outputTokens: 35, totalTokens: 125 },
          };
        }

        if (model === primaryModel) {
          const error = new Error('rate limit exceeded');
          (error as Error & { status?: number }).status = 429;
          throw error;
        }

        return {
          text: JSON.stringify(expected),
          usage: { inputTokens: 110, outputTokens: 45, totalTokens: 155 },
        };
      }
    );

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateStructuredOutputWithFallback({
      ...baseOptions,
      model: primaryModel,
    });

    expect(result.object).toEqual(expected);
    expect(structuredCalls()).toHaveLength(2);
    expect(textFallbackCalls()).toHaveLength(1);
  });

  it('falls back to the next provider when schema fallback returns invalid JSON', async () => {
    const primaryModel = languageModel('primary');
    const fallbackModel = languageModel('fallback');
    const expected: TestSchema = {
      selectedAgent: 'Advisor Agent',
      confidence: 0.77,
      reasoning: 'Recovered on second provider after invalid JSON fallback',
    };

    mockGenerateText.mockImplementation(
      async ({ model, output }: { model: unknown; output?: unknown }) => {
        if (output) {
          if (model === primaryModel) {
            throw new Error('response format not supported');
          }
          return {
            output: expected,
            usage: { inputTokens: 95, outputTokens: 30, totalTokens: 125 },
          };
        }

        return {
          text: 'not valid json at all',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        };
      }
    );

    mockSelectTextModel.mockReturnValue({
      model: fallbackModel,
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });

    const result = await generateStructuredOutputWithFallback({
      ...baseOptions,
      model: primaryModel,
    });

    expect(result.object).toEqual(expected);
    expect(structuredCalls()).toHaveLength(2);
    expect(textFallbackCalls()).toHaveLength(1);
  });

  it('throws combined error when fallback text also fails parsing', async () => {
    mockGenerateText
      .mockRejectedValueOnce(
        new Error('Schema output validation failed: bad data')
      )
      .mockResolvedValueOnce({
        text: 'not valid json at all',
        usage: {},
      });

    await expect(
      generateStructuredOutputWithFallback(baseOptions)
    ).rejects.toThrow(
      /Structured output failed and text fallback also failed/
    );
  });

  it('validates structured output result against schema', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: { selectedAgent: 'NLQ Agent' },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          selectedAgent: 'NLQ Agent',
          confidence: 0.9,
          reasoning: 'Recovered via fallback',
        }),
        usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
      });

    const result = await generateStructuredOutputWithFallback(baseOptions);

    expect(result.object.reasoning).toBe('Recovered via fallback');
    expect(structuredCalls()).toHaveLength(1);
    expect(textFallbackCalls()).toHaveLength(1);
  });

  it('handles missing usage gracefully', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        selectedAgent: 'Advisor Agent',
        confidence: 0.85,
        reasoning: 'Advice needed',
      },
      usage: undefined,
    });

    const result = await generateStructuredOutputWithFallback(baseOptions);

    expect(result.object.selectedAgent).toBe('Advisor Agent');
    expect(result.usage).toBeUndefined();
  });

  it('includes fallbackPromptExtra in text fallback prompt', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('response format not supported'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          selectedAgent: 'NLQ Agent',
          confidence: 0.6,
          reasoning: 'Extra context used',
        }),
        usage: {},
      });

    await generateStructuredOutputWithFallback({
      ...baseOptions,
      fallbackPromptExtra: '에이전트는 5개입니다.',
    });

    const callArgs = textFallbackCalls()[0]?.[0] as GenerateTextCall;
    expect(callArgs.prompt).toContain('에이전트는 5개입니다.');
  });

  it('waits before switching providers after structured-output provider failure', async () => {
    vi.useFakeTimers();

    mockGenerateText
      .mockRejectedValueOnce(new Error('rate limit exceeded: 429'))
      .mockResolvedValueOnce({
        output: {
          selectedAgent: 'Analyst Agent',
          confidence: 0.91,
          reasoning: 'Fallback after provider delay',
        },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });

    mockSelectTextModel.mockReturnValue({
      model: languageModel('groq'),
      provider: 'groq',
      modelId: 'groq-model',
    });

    const promise = generateStructuredOutputWithFallback({
      ...baseOptions,
      operation: 'routing-delay-test',
      providerFallbackControl: {
        fallbackDelayMs: 10,
        fallbackJitterMs: 0,
      },
    });

    await Promise.resolve();
    expect(structuredCalls()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(9);
    expect(structuredCalls()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    const result = await promise;
    expect(result.object.selectedAgent).toBe('Analyst Agent');
    expect(structuredCalls()).toHaveLength(2);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });

  it('fails fast when retry budget blocks structured-output provider fallback', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('rate limit exceeded: 429'));
    mockSelectTextModel.mockReturnValue({
      model: languageModel('groq'),
      provider: 'groq',
      modelId: 'groq-model',
    });

    await expect(
      generateStructuredOutputWithFallback({
        ...baseOptions,
        operation: 'routing-budget-test',
        providerFallbackControl: {
          fallbackDelayMs: 0,
          fallbackJitterMs: 0,
          retryBudgetPerMinute: 0,
        },
      })
    ).rejects.toThrow('rate limit exceeded: 429');

    expect(structuredCalls()).toHaveLength(1);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });

  it('applies the same fallback delay when text fallback parsing fails', async () => {
    vi.useFakeTimers();

    const expected: TestSchema = {
      selectedAgent: 'Reporter Agent',
      confidence: 0.82,
      reasoning: 'Recovered after delayed text fallback failure',
    };

    mockGenerateText
      .mockRejectedValueOnce(new Error('response format not supported'))
      .mockResolvedValueOnce({
        text: 'not-json',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      })
      .mockResolvedValueOnce({
        output: expected,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
    mockSelectTextModel.mockReturnValue({
      model: languageModel('groq'),
      provider: 'groq',
      modelId: 'groq-model',
    });

    const promise = generateStructuredOutputWithFallback({
      ...baseOptions,
      operation: 'routing-text-fallback-test',
      providerFallbackControl: {
        fallbackDelayMs: 15,
        fallbackJitterMs: 0,
      },
    });

    await Promise.resolve();
    expect(structuredCalls()).toHaveLength(1);
    expect(textFallbackCalls()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(14);
    expect(structuredCalls()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    const result = await promise;
    expect(result.object).toEqual(expected);
    expect(structuredCalls()).toHaveLength(2);
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
  });
});
