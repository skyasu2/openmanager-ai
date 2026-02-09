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

// Store generateText mock for manipulation in tests
const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: vi.fn(() => () => false),
}));

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
    it('should execute with default options', async () => {
      const { BaseAgent } = await import('./base-agent');
      const mockConfig = createMockConfig();

      // Create a concrete implementation for testing
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

      expect(result.success).toBe(true);
      expect(result.text).toBe('Mock response from generateText');
      expect(result.metadata.provider).toBe('test-provider');
      expect(result.metadata.modelId).toBe('test-model');
    });

    it('should apply timeout configuration', async () => {
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
      await agent.run('test query', { timeoutMs: 30000 });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: { totalMs: 30000 },
        })
      );
    });

    it('should extract finalAnswer from toolResults', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockResolvedValue({
        text: '', // Empty text, should use finalAnswer
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        steps: [
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: 'Final answer from tool' },
              },
            ],
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

      expect(result.success).toBe(true);
      expect(result.text).toBe('Final answer from tool');
      expect(result.toolsCalled).toContain('finalAnswer');
    });

    it('should fallback to result.text when no finalAnswer', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockResolvedValue({
        text: 'Regular text response',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        steps: [
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: { cpu: 50 },
              },
            ],
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

      expect(result.success).toBe(true);
      expect(result.text).toBe('Regular text response');
    });

    it('should handle non-string finalAnswer gracefully', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockGenerateText.mockResolvedValue({
        text: 'Fallback text',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        steps: [
          {
            finishReason: 'stop',
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: 123 }, // Non-string answer
              },
            ],
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

      // Should use fallback text since answer is not a string
      expect(result.success).toBe(true);
      expect(result.text).toBe('Fallback text');
    });

    it('should return error result when config not found', async () => {
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
      const result = await agent.run('test query');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent Test Agent config not found');
      expect(result.metadata.provider).toBe('none');
    });

    it('should return error result on model unavailable', async () => {
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
      const result = await agent.run('test query');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No model available for Test Agent');
    });

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

  // ==========================================================================
  // stream() Tests
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

    it('should yield done event with metadata', async () => {
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

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents.length).toBe(1);

      const doneData = doneEvents[0].data as {
        success: boolean;
        finalAgent: string;
        toolsCalled: string[];
        metadata: { provider: string; modelId: string; durationMs: number };
      };
      expect(doneData.success).toBe(true);
      expect(doneData.finalAgent).toBe('Test Agent');
      expect(doneData.metadata.provider).toBe('test-provider');
      expect(doneData.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should yield error event when config not found', async () => {
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
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].data as { code: string }).code).toBe('CONFIG_NOT_FOUND');
    });

    it('should yield error event when model unavailable', async () => {
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
      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of agent.stream('test query')) {
        events.push(event);
      }

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].data as { code: string }).code).toBe('MODEL_UNAVAILABLE');
    });

    it('should handle stream errors gracefully', async () => {
      const { BaseAgent } = await import('./base-agent');

      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          throw new Error('Stream connection lost');
        })(),
        steps: Promise.resolve([]),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
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

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].data as { code: string }).code).toBe('STREAM_ERROR');
    });
  });

  // ==========================================================================
  // filterTools() Tests
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

    it('should return array with mixed content (text + images + files)', async () => {
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
      const result = agent.testBuildUserContent('Analyze these files', {
        images: [
          { data: 'data:image/jpeg;base64,img1', mimeType: 'image/jpeg' },
          { data: 'data:image/png;base64,img2', mimeType: 'image/png' },
        ],
        files: [
          { data: 'data:text/plain;base64,txt1', mimeType: 'text/plain' },
        ],
      });

      expect(Array.isArray(result)).toBe(true);
      const parts = result as Array<{ type: string }>;

      // 1 text + 2 images + 1 file = 4 parts
      expect(parts).toHaveLength(4);
      expect(parts[0].type).toBe('text');
      expect(parts[1].type).toBe('image');
      expect(parts[2].type).toBe('image');
      expect(parts[3].type).toBe('file');
    });

    it('should handle empty images array as text-only', async () => {
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
      const result = agent.testBuildUserContent('Just text', {
        images: [],
        files: [],
      });

      // Empty arrays should result in text-only
      expect(typeof result).toBe('string');
      expect(result).toBe('Just text');
    });
  });
});
