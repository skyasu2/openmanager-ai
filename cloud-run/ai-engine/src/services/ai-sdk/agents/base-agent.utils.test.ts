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
  getMistralModel: vi.fn(() => ({ modelId: 'mistral-large-3-25-12' })),
  getGeminiFlashLiteModel: vi.fn(() => ({ modelId: 'gemini-2.5-flash-lite' })),
}));

// Mock text-sanitizer
vi.mock('../../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../../lib/config-parser', () => ({
  isOpenRouterVisionToolCallingEnabled: vi.fn(() => false),
  getUpstashConfig: vi.fn(() => null),
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

describe('BaseAgent', { timeout: 60000 }, () => {
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

  describe('filterTools()', () => {
    it('should remove web search tools when disabled', async () => {
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
      await agent.run('test query', { webSearchEnabled: false });

      // Check that generateText was called with filtered tools
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.tools).not.toHaveProperty('searchWeb');
      expect(callArgs.tools).toHaveProperty('testTool');
      expect(callArgs.tools).toHaveProperty('finalAnswer');
    });

    it('should preserve all tools when webSearchEnabled=true', async () => {
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
      await agent.run('test query', { webSearchEnabled: true });

      // Check that generateText was called with all tools
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.tools).toHaveProperty('searchWeb');
      expect(callArgs.tools).toHaveProperty('testTool');
      expect(callArgs.tools).toHaveProperty('finalAnswer');
    });

    it('should preserve all tools by default', async () => {
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
      await agent.run('test query'); // No webSearchEnabled option

      // Check that generateText was called with all tools
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.tools).toHaveProperty('searchWeb');
    });

    it('should disable tools for Vision Agent on OpenRouter by default', async () => {
      const { BaseAgent } = await import('./base-agent');

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
      await agent.run('test query');

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.tools).toEqual({});
    });

    it('should keep tools when OPENROUTER_VISION_TOOL_CALLING is enabled', async () => {
      const { BaseAgent } = await import('./base-agent');
      vi.mocked(isOpenRouterVisionToolCallingEnabled).mockReturnValue(true);

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
      await agent.run('test query');

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.tools).toHaveProperty('finalAnswer');
      expect(callArgs.tools).toHaveProperty('searchWeb');
    });
  });

  // ==========================================================================
  // isAvailable() Tests
  // ==========================================================================

  describe('isAvailable()', () => {
    it('should return true when model is configured', async () => {
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
      expect(agent.isAvailable()).toBe(true);
    });

    it('should return false when config is null', async () => {
      const { BaseAgent } = await import('./base-agent');

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return null;
        }
      }

      const agent = new TestAgent();
      expect(agent.isAvailable()).toBe(false);
    });

    it('should return false when getModel returns null', async () => {
      const { BaseAgent } = await import('./base-agent');

      const mockConfig = createMockConfig({
        getModel: () => null,
      });

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
      }

      const agent = new TestAgent();
      expect(agent.isAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // buildUserContent() Tests (Phase 4 추가 - 멀티모달)
  // ==========================================================================

  describe('buildUserContent()', () => {
    it('should return string for text-only query', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
        // Expose protected method for testing
        testBuildUserContent(query: string, options: Parameters<typeof this.buildUserContent>[1]) {
          return this.buildUserContent(query, options);
        }
      }

      const agent = new TestAgent();
      const result = agent.testBuildUserContent('Hello, analyze this server', {});

      // Text-only should return simple string
      expect(typeof result).toBe('string');
      expect(result).toBe('Hello, analyze this server');
    });

    it('should return array with ImagePart when images provided', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
        testBuildUserContent(query: string, options: Parameters<typeof this.buildUserContent>[1]) {
          return this.buildUserContent(query, options);
        }
      }

      const agent = new TestAgent();
      const result = agent.testBuildUserContent('Analyze this image', {
        images: [
          { data: 'data:image/png;base64,abc123', mimeType: 'image/png', name: 'test.png' },
        ],
      });

      // Multimodal should return array
      expect(Array.isArray(result)).toBe(true);
      const parts = result as Array<{ type: string }>;
      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('text');
      expect(parts[1].type).toBe('image');

      // Check ImagePart structure
      const imagePart = parts[1] as { type: string; image: string; mimeType: string };
      expect(imagePart.image).toBe('data:image/png;base64,abc123');
      expect(imagePart.mimeType).toBe('image/png');
    });

    it('should return array with FilePart when files provided (uses mediaType)', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      class TestAgent extends BaseAgent {
        getName(): string {
          return 'Test Agent';
        }
        getConfig() {
          return mockConfig;
        }
        testBuildUserContent(query: string, options: Parameters<typeof this.buildUserContent>[1]) {
          return this.buildUserContent(query, options);
        }
      }

      const agent = new TestAgent();
      const result = agent.testBuildUserContent('Analyze this PDF', {
        files: [
          { data: 'data:application/pdf;base64,xyz789', mimeType: 'application/pdf', name: 'doc.pdf' },
        ],
      });

      // Multimodal should return array
      expect(Array.isArray(result)).toBe(true);
      const parts = result as Array<{ type: string }>;
      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('text');
      expect(parts[1].type).toBe('file');

      // Check FilePart structure - AI SDK uses 'mediaType' not 'mimeType'
      const filePart = parts[1] as { type: string; data: string; mediaType: string };
      expect(filePart.data).toBe('data:application/pdf;base64,xyz789');
      expect(filePart.mediaType).toBe('application/pdf'); // AI SDK uses mediaType
    });

  });
});
