/**
 * AgentFactory Tests
 *
 * Unit tests for the AgentFactory pattern.
 * Tests agent creation, availability checks, and type mappings.
 *
 * @version 1.0.0
 * @created 2026-01-27
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock model objects that simulate LanguageModel interface
const createMockModel = (id: string) => ({
  modelId: id,
  provider: 'mock',
  specificationVersion: 'v1',
  defaultObjectGenerationMode: 'json',
  doGenerate: vi.fn(),
  doStream: vi.fn(),
});

// Mock config module before imports
vi.mock('./config', () => {
  const mockConfig = (name: string) => ({
    name,
    description: `Mock ${name} description`,
    getModel: vi.fn(() => ({
      model: createMockModel(`mock-${name}`),
      provider: 'mock-provider',
      modelId: `mock-${name}`,
    })),
    instructions: `You are ${name}.`,
    tools: {},
    matchPatterns: name === 'Evaluator Agent' || name === 'Optimizer Agent' ? [] : ['test'],
  });

  return {
    AGENT_CONFIGS: {
      'NLQ Agent': mockConfig('NLQ Agent'),
      'Analyst Agent': mockConfig('Analyst Agent'),
      'Reporter Agent': mockConfig('Reporter Agent'),
      'Advisor Agent': mockConfig('Advisor Agent'),
      'Vision Agent': mockConfig('Vision Agent'),
      'Evaluator Agent': mockConfig('Evaluator Agent'),
      'Optimizer Agent': mockConfig('Optimizer Agent'),
    },
    getAgentConfig: vi.fn((name: string) => mockConfig(name)),
    isAgentAvailable: vi.fn(() => true),
    getAvailableAgents: vi.fn(() => ['NLQ Agent', 'Analyst Agent', 'Reporter Agent', 'Advisor Agent', 'Vision Agent']),
  };
});

// Mock text-sanitizer
vi.mock('../../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

// Mock AI SDK with ToolLoopAgent
vi.mock('ai', () => {
  const mockGenerateText = vi.fn(async () => ({
    text: 'Mock response',
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    steps: [{ finishReason: 'stop', toolCalls: [], toolResults: [] }],
  }));
  const mockStreamText = vi.fn(() => ({
    textStream: (async function* () {
      yield 'Mock response';
    })(),
    steps: Promise.resolve([]),
    usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
  }));

  class MockToolLoopAgent {
    settings: Record<string, unknown>;
    constructor(settings: Record<string, unknown>) {
      this.settings = settings;
    }
    async generate(options: Record<string, unknown>) {
      const { timeout, onStepFinish, ...rest } = options as Record<string, unknown>;
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
      const { timeout, onStepFinish, ...rest } = options as Record<string, unknown>;
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
    tool: vi.fn((config: unknown) => ({ ...(config as object), _type: 'tool' })),
  };
});

// Mock tools
vi.mock('../../../../tools-ai-sdk', () => ({
  getServerMetrics: { execute: vi.fn() },
  getServerMetricsAdvanced: { execute: vi.fn() },
  filterServers: { execute: vi.fn() },
  getServerByGroup: { execute: vi.fn() },
  getServerByGroupAdvanced: { execute: vi.fn() },
  detectAnomalies: { execute: vi.fn() },
  predictTrends: { execute: vi.fn() },
  analyzePattern: { execute: vi.fn() },
  correlateMetrics: { execute: vi.fn() },
  findRootCause: { execute: vi.fn() },
  buildIncidentTimeline: { execute: vi.fn() },
  searchKnowledgeBase: { execute: vi.fn() },
  recommendCommands: { execute: vi.fn() },
  searchWeb: { execute: vi.fn() },
  finalAnswer: { execute: vi.fn() },
  evaluateIncidentReport: { execute: vi.fn() },
  validateReportStructure: { execute: vi.fn() },
  scoreRootCauseConfidence: { execute: vi.fn() },
  refineRootCauseAnalysis: { execute: vi.fn() },
  enhanceSuggestedActions: { execute: vi.fn() },
  extendServerCorrelation: { execute: vi.fn() },
  analyzeScreenshot: { execute: vi.fn() },
  analyzeLargeLog: { execute: vi.fn() },
  searchWithGrounding: { execute: vi.fn() },
  analyzeUrlContent: { execute: vi.fn() },
}));

// ============================================================================
// AgentFactory Tests
// ============================================================================

describe('AgentFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // create() Tests
  // ==========================================================================

  describe('create()', () => {
    it('should create agent for type "nlq"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('nlq');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('NLQ Agent');
    });

    it('should create agent for type "analyst"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('analyst');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Analyst Agent');
    });

    it('should create agent for type "reporter"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('reporter');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Reporter Agent');
    });

    it('should create agent for type "advisor"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('advisor');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Advisor Agent');
    });

    it('should create agent for type "vision"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('vision');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Vision Agent');
    });

    it('should create agent for type "evaluator"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('evaluator');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Evaluator Agent');
    });

    it('should create agent for type "optimizer"', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('optimizer');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Optimizer Agent');
    });

    it('should return null for unknown agent type', async () => {
      const { AgentFactory } = await import('./agent-factory');

      // @ts-expect-error Testing invalid type
      const agent = AgentFactory.create('unknown');

      expect(agent).toBeNull();
    });
  });

  // ==========================================================================
  // createByName() Tests
  // ==========================================================================

  describe('createByName()', () => {
    it('should create agent by config key name', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.createByName('NLQ Agent');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('NLQ Agent');
    });

    it('should create Analyst Agent by name', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.createByName('Analyst Agent');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Analyst Agent');
    });

    it('should create Vision Agent by name', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.createByName('Vision Agent');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Vision Agent');
    });

    it('should return null for unknown config key', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.createByName('Unknown Agent');

      expect(agent).toBeNull();
    });
  });

  // ==========================================================================
  // isAvailable() Tests
  // ==========================================================================

  describe('isAvailable()', () => {
    it('should return true when model configured', async () => {
      const { AgentFactory } = await import('./agent-factory');

      expect(AgentFactory.isAvailable('nlq')).toBe(true);
      expect(AgentFactory.isAvailable('analyst')).toBe(true);
      expect(AgentFactory.isAvailable('reporter')).toBe(true);
      expect(AgentFactory.isAvailable('advisor')).toBe(true);
    });

    it('should return true for Vision Agent when Gemini available', async () => {
      const { AgentFactory } = await import('./agent-factory');

      expect(AgentFactory.isAvailable('vision')).toBe(true);
    });

    // Note: Tests for Gemini unavailability and no providers available
    // require dynamic mock changes which have vitest hoisting issues.
    // These scenarios are better tested via integration tests.
  });

  // ==========================================================================
  // getAvailabilityStatus() Tests
  // ==========================================================================

  describe('getAvailabilityStatus()', () => {
    it('should return status for all agent types', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const status = AgentFactory.getAvailabilityStatus();

      expect(status).toHaveProperty('nlq');
      expect(status).toHaveProperty('analyst');
      expect(status).toHaveProperty('reporter');
      expect(status).toHaveProperty('advisor');
      expect(status).toHaveProperty('vision');
      expect(status).toHaveProperty('evaluator');
      expect(status).toHaveProperty('optimizer');
    });

    it('should return true for all agents when providers available', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const status = AgentFactory.getAvailabilityStatus();

      expect(status.nlq).toBe(true);
      expect(status.analyst).toBe(true);
      expect(status.reporter).toBe(true);
      expect(status.advisor).toBe(true);
      expect(status.vision).toBe(true);
    });

    // Note: Test for Gemini unavailability requires dynamic mock changes.
  });

  // ==========================================================================
  // getAvailableTypes() Tests
  // ==========================================================================

  describe('getAvailableTypes()', () => {
    it('should return all available agent types', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const types = AgentFactory.getAvailableTypes();

      expect(types).toContain('nlq');
      expect(types).toContain('analyst');
      expect(types).toContain('reporter');
      expect(types).toContain('advisor');
      expect(types).toContain('vision');
    });

    // Note: Test for unavailable agents requires dynamic mock changes.
  });

  // ==========================================================================
  // runAgent Convenience Function Tests
  // ==========================================================================

  describe('runAgent()', () => {
    it('should create and run agent in one call', async () => {
      const { runAgent } = await import('./agent-factory');

      const result = await runAgent('nlq', 'test query');

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    // Note: Test for unavailable agent requires dynamic mock changes.

    it('should pass options to agent.run()', async () => {
      const { runAgent } = await import('./agent-factory');

      const result = await runAgent('nlq', 'test query', {
        timeoutMs: 30000,
        webSearchEnabled: false,
      });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });
  });

  // ==========================================================================
  // streamAgent Convenience Function Tests
  // ==========================================================================

  describe('streamAgent()', () => {
    it('should create and stream agent in one call', async () => {
      const { streamAgent } = await import('./agent-factory');

      const events: Array<{ type: string; data: unknown }> = [];

      for await (const event of streamAgent('nlq', 'test query')) {
        events.push(event);
      }

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents.length).toBe(1);
    });

    // Note: Test for unavailable agent requires dynamic mock changes.
  });

  // ==========================================================================
  // Type Mapping Tests
  // ==========================================================================

  describe('Type Mappings', () => {
    it('should correctly map agent types to config keys', async () => {
      const { AGENT_TYPE_TO_CONFIG_KEY } = await import('./agent-factory');

      expect(AGENT_TYPE_TO_CONFIG_KEY.nlq).toBe('NLQ Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.analyst).toBe('Analyst Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.reporter).toBe('Reporter Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.advisor).toBe('Advisor Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.vision).toBe('Vision Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.evaluator).toBe('Evaluator Agent');
      expect(AGENT_TYPE_TO_CONFIG_KEY.optimizer).toBe('Optimizer Agent');
    });

    it('should correctly map config keys to agent types', async () => {
      const { CONFIG_KEY_TO_AGENT_TYPE } = await import('./agent-factory');

      expect(CONFIG_KEY_TO_AGENT_TYPE['NLQ Agent']).toBe('nlq');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Analyst Agent']).toBe('analyst');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Reporter Agent']).toBe('reporter');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Advisor Agent']).toBe('advisor');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Vision Agent']).toBe('vision');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Evaluator Agent']).toBe('evaluator');
      expect(CONFIG_KEY_TO_AGENT_TYPE['Optimizer Agent']).toBe('optimizer');
    });
  });
});
