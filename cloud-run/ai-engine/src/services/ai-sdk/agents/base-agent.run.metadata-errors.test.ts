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

// Store generateText mock for manipulation in tests (hoisted for proper mock timing)
const { mockGenerateText, mockStreamText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
}));

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

describe('BaseAgent', { timeout: 15000 }, () => {
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

  describe('run()', () => {
    it('should handle generateText errors gracefully', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockRejectedValue(new Error('API rate limit exceeded'));

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
      const result = await agent.run('test query');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track token usage correctly', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockResolvedValue({
        text: 'Response',
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        steps: [{ finishReason: 'stop', toolCalls: [], toolResults: [] }],
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
      const result = await agent.run('test query');

      expect(result.usage.promptTokens).toBe(200);
      expect(result.usage.completionTokens).toBe(100);
      expect(result.usage.totalTokens).toBe(300);
    });

    it('should track tools called during execution', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockResolvedValue({
        text: 'Response',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        steps: [
          {
            finishReason: 'tool_calls',
            toolCalls: [{ toolName: 'getServerMetrics' }, { toolName: 'detectAnomalies' }],
            toolResults: [],
          },
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [],
          },
        ],
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
      const result = await agent.run('test query');

      expect(result.toolsCalled).toContain('getServerMetrics');
      expect(result.toolsCalled).toContain('detectAnomalies');
      expect(result.toolsCalled).toContain('finalAnswer');
      expect(result.metadata.steps).toBe(2);
    });
  });

});
