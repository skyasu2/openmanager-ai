import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGenerateObject = vi.fn();
const mockGenerateText = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

import { generateObjectWithFallback } from './orchestrator-object-fallback';

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
};

describe('generateObjectWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should rethrow original error when fallback text also fails parsing', async () => {
    const originalError = new Error('Schema output validation failed: bad data');
    mockGenerateObject.mockRejectedValue(originalError);

    mockGenerateText.mockResolvedValue({
      text: 'not valid json at all',
      usage: {},
    });

    await expect(generateObjectWithFallback(baseOptions)).rejects.toThrow(
      originalError
    );
  });

  it('should validate generateObject result against schema', async () => {
    // generateObject returns an object that doesn't match schema
    mockGenerateObject.mockResolvedValue({
      object: { selectedAgent: 'NLQ Agent' }, // missing confidence and reasoning
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    // This triggers schema validation failure → schema error → text fallback
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
});
