/**
 * BaseAgent Tests
 *
 * Unit tests for the BaseAgent abstract class.
 * Tests execution patterns, timeout handling, tool filtering, and finalAnswer extraction.
 *
 * @version 1.0.0
 * @created 2026-01-27
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tool } from 'ai';
import { isOpenRouterVisionToolCallingEnabled } from '../../../lib/config-parser';

// Mock model-provider before imports
vi.mock('../model-provider', () => ({
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: true,
  })),
  getCerebrasModel: vi.fn(() => ({ modelId: 'llama-3.3-70b' })),
  getGroqModel: vi.fn(() => ({ modelId: 'llama-3.3-70b-versatile' })),
  getMistralModel: vi.fn(() => ({ modelId: 'mistral-small-2506' })),
  getGeminiFlashLiteModel: vi.fn(() => ({ modelId: 'gemini-2.5-flash-lite' })),
}));

// Mock text-sanitizer
vi.mock('../../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../../lib/config-parser', () => ({
  isOpenRouterVisionToolCallingEnabled: vi.fn(() => false),
}));

// Store generateText mock for manipulation in tests
const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

// Mock AI SDK with ToolLoopAgent
vi.mock('ai', () => {
  // MockToolLoopAgent mimics ToolLoopAgent behavior: delegates to generateText/streamText
  class MockToolLoopAgent {
    settings: Record<string, unknown>;
    constructor(settings: Record<string, unknown>) {
      this.settings = settings;
    }
    async generate(options: Record<string, unknown>) {
      const { abortSignal, timeout, onStepFinish, ...rest } = options as Record<string, unknown>;
      const { onStepFinish: _sOSF, instructions, ...settingsRest } = this.settings;
      return mockGenerateText({
        ...settingsRest,
        system: instructions,
        ...rest,
        timeout,
        onStepFinish,
      });
    }
    async stream(options: Record<string, unknown>) {
      const { abortSignal, timeout, onStepFinish, ...rest } = options as Record<string, unknown>;
      const { onStepFinish: _sOSF, instructions, ...settingsRest } = this.settings;
      return mockStreamText({
        ...settingsRest,
        system: instructions,
        ...rest,
        timeout,
        onStepFinish,
      });
    }
  }

  return {
    generateText: mockGenerateText,
    streamText: mockStreamText,
    ToolLoopAgent: MockToolLoopAgent,
    hasToolCall: vi.fn(() => () => false),
    stepCountIs: vi.fn(() => () => false),
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock AgentConfig
 */
function createMockConfig(overrides: Partial<{
  name: string;
  getModel: () => { model: unknown; provider: string; modelId: string } | null;
  instructions: string;
  tools: Record<string, Tool>;
}> = {}) {
  return {
    name: 'Test Agent',
    description: 'Test agent for unit tests',
    getModel: () => ({
      model: { modelId: 'test-model' },
      provider: 'test-provider',
      modelId: 'test-model',
    }),
    instructions: 'You are a test agent.',
    tools: {
      testTool: { execute: vi.fn() } as unknown as Tool,
      searchWeb: { execute: vi.fn() } as unknown as Tool,
      finalAnswer: { execute: vi.fn() } as unknown as Tool,
    },
    matchPatterns: ['test'],
    ...overrides,
  };
}

// ============================================================================
// BaseAgent Tests
// ============================================================================

describe('BaseAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isOpenRouterVisionToolCallingEnabled).mockReturnValue(false);

    // Default mock for generateText - successful response
    mockGenerateText.mockResolvedValue({
      text: 'Mock response from generateText',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      steps: [
        {
          finishReason: 'stop',
          toolCalls: [],
          toolResults: [],
        },
      ],
    });

    // Default mock for streamText - successful response
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'Mock ';
        yield 'streaming ';
        yield 'response';
      })(),
      steps: Promise.resolve([
        {
          finishReason: 'stop',
          toolCalls: [],
          toolResults: [],
        },
      ]),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // run() Tests
  // ==========================================================================

  describe('stream()', () => {
    it('should yield text_delta events', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      const textDeltas = events.filter(e => e.type === 'text_delta');
      expect(textDeltas.length).toBeGreaterThan(0);
      expect(textDeltas[0].data).toBe('Mock ');
    });

    it('should extract finalAnswer when stream is empty', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          // Empty stream - only whitespace
          yield '   ';
        })(),
        steps: Promise.resolve([
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: 'Final answer from stream' },
              },
            ],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
      });

      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      // Should have emitted finalAnswer as text_delta
      const textDeltas = events.filter(e => e.type === 'text_delta');
      expect(textDeltas.length).toBe(1);
      expect(textDeltas[0].data).toBe('Final answer from stream');
    });

    it('should ignore whitespace-only content for hasTextContent', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          yield '    '; // Only whitespace
          yield '\n\n';
          yield '\t';
        })(),
        steps: Promise.resolve([
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: 'Fallback answer' },
              },
            ],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
      });

      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      // Should emit finalAnswer since no meaningful text content
      const textDeltas = events.filter(e => e.type === 'text_delta');
      expect(textDeltas.length).toBe(1);
      expect(textDeltas[0].data).toBe('Fallback answer');
    });

    it('should emit EMPTY_RESPONSE warning and fallback text for Vision OpenRouter empty stream', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          yield '   ';
          yield '\n';
        })(),
        steps: Promise.resolve([
          {
            finishReason: 'length',
            toolCalls: [],
            toolResults: [],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 120, outputTokens: 64, totalTokens: 184 }),
      });

      const mockConfig = createMockConfig({
        getModel: () => ({
          model: { modelId: 'nvidia/nemotron-nano-12b-v2-vl:free' },
          provider: 'openrouter',
          modelId: 'nvidia/nemotron-nano-12b-v2-vl:free',
        }),
      });

      class VisionTestAgent extends BaseAgent {
        getName(): string {
          return 'Vision Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new VisionTestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('vision query', { maxOutputTokens: 64 })) {
        events.push(event);
      }

      const callArgs = mockStreamText.mock.calls[0][0];
      expect(callArgs.maxOutputTokens).toBe(256);

      const warningEvent = events.find((e) => e.type === 'warning');
      expect(warningEvent).toBeDefined();
      expect((warningEvent!.data as { code: string }).code).toBe('EMPTY_RESPONSE');

      const textDeltas = events.filter((e) => e.type === 'text_delta');
      expect(textDeltas.at(-1)?.data).toBe(
        '비전 분석 모델 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.'
      );
    });

    it('should treat whitespace finalAnswer as empty and emit fallback text', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          // No meaningful streamed text
        })(),
        steps: Promise.resolve([
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: '   \n\t' },
              },
            ],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 120, outputTokens: 40, totalTokens: 160 }),
      });

      const mockConfig = createMockConfig({
        getModel: () => ({
          model: { modelId: 'nvidia/nemotron-nano-12b-v2-vl:free' },
          provider: 'openrouter',
          modelId: 'nvidia/nemotron-nano-12b-v2-vl:free',
        }),
      });

      class VisionTestAgent extends BaseAgent {
        getName(): string {
          return 'Vision Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new VisionTestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('vision query')) {
        events.push(event);
      }

      const warningEvent = events.find((e) => e.type === 'warning');
      expect(warningEvent).toBeDefined();
      expect((warningEvent!.data as { code: string }).code).toBe('EMPTY_RESPONSE');

      const textDeltas = events.filter((e) => e.type === 'text_delta');
      expect(textDeltas.at(-1)?.data).toBe(
        '비전 분석 모델 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.'
      );
    });

    it('should apply chunkMs timeout', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query', { timeoutMs: 60000 })) {
        events.push(event);
      }

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: { totalMs: 60000, chunkMs: 30000 },
        })
      );
    });

    it('should yield tool_call events', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          yield 'Processing...';
        })(),
        steps: Promise.resolve([
          {
            finishReason: 'tool_calls',
            toolCalls: [{ toolName: 'getServerMetrics' }, { toolName: 'detectAnomalies' }],
            toolResults: [],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
      });

      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      const toolCalls = events.filter(e => e.type === 'tool_call');
      expect(toolCalls.length).toBe(2);
      expect((toolCalls[0].data as { name: string }).name).toBe('getServerMetrics');
      expect((toolCalls[1].data as { name: string }).name).toBe('detectAnomalies');
    });

  });

  // ==========================================================================
  // filterTools() Tests
  // ==========================================================================

});
