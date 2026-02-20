/**
 * VisionAgent Tests
 *
 * Unit tests for the VisionAgent and its utility functions.
 * Tests query detection, fallback handling, and Gemini-specific behavior.
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

  // Vision Agent uses real matchPatterns so keyword detection tests work
  const visionPatterns: (string | RegExp)[] = [
    '스크린샷', 'screenshot', '이미지', 'image', '사진', '그래프', '차트',
    '대시보드', 'dashboard', 'grafana', 'cloudwatch', 'datadog',
    '로그 분석', '대용량', 'log', '전체 로그',
    '최신', '문서', 'documentation', '공식', 'official',
    'url', '링크', '페이지',
    /스크린샷.*분석|분석.*스크린샷/i,
    /이미지.*보여|첨부.*분석/i,
    /로그.*전체|대용량.*로그/i,
    /최신.*문서|공식.*가이드/i,
  ];

  return {
    AGENT_CONFIGS: {
      'NLQ Agent': mockConfig('NLQ Agent'),
      'Analyst Agent': mockConfig('Analyst Agent'),
      'Reporter Agent': mockConfig('Reporter Agent'),
      'Advisor Agent': mockConfig('Advisor Agent'),
      'Vision Agent': { ...mockConfig('Vision Agent'), matchPatterns: visionPatterns },
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
// VisionAgent Tests
// ============================================================================

describe('VisionAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // isVisionQuery() Tests
  // ==========================================================================

  describe('isVisionQuery()', () => {
    it('should detect screenshot keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('스크린샷 분석해줘')).toBe(true);
      expect(isVisionQuery('이 screenshot을 봐줘')).toBe(true);
      expect(isVisionQuery('이미지 확인해줘')).toBe(true);
      expect(isVisionQuery('사진을 분석해줘')).toBe(true);
    });

    it('should detect dashboard keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('대시보드 상태 확인')).toBe(true);
      expect(isVisionQuery('Grafana 화면 분석')).toBe(true);
      expect(isVisionQuery('CloudWatch 대시보드 확인')).toBe(true);
      expect(isVisionQuery('Datadog 메트릭 화면')).toBe(true);
    });

    it('should detect large log keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('대용량 로그 분석해줘')).toBe(true);
      expect(isVisionQuery('전체 로그 파일 확인')).toBe(true);
      expect(isVisionQuery('로그 분석 요청')).toBe(true);
    });

    it('should detect Google Search Grounding keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('최신 문서 검색해줘')).toBe(true);
      expect(isVisionQuery('공식 documentation 확인')).toBe(true);
      expect(isVisionQuery('official 가이드 찾아줘')).toBe(true);
    });

    it('should detect URL keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('이 url 내용 분석해줘')).toBe(true);
      expect(isVisionQuery('링크 확인해줘')).toBe(true);
      expect(isVisionQuery('페이지 내용 분석')).toBe(true);
    });

    it('should detect pattern-based queries', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('스크린샷을 분석해줘')).toBe(true);
      expect(isVisionQuery('분석해줘 이 스크린샷')).toBe(true);
      expect(isVisionQuery('이미지를 보여줘')).toBe(true);
      expect(isVisionQuery('첨부된 파일 분석해줘')).toBe(true);
    });

    it('should return false for non-vision queries', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('서버 상태 알려줘')).toBe(false);
      expect(isVisionQuery('CPU 사용량 확인')).toBe(false);
      expect(isVisionQuery('장애 보고서 만들어줘')).toBe(false);
      expect(isVisionQuery('안녕하세요')).toBe(false);
      expect(isVisionQuery('메모리 이상 탐지')).toBe(false);
    });

    it('should be case insensitive', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('SCREENSHOT 분석')).toBe(true);
      expect(isVisionQuery('Dashboard 확인')).toBe(true);
      expect(isVisionQuery('GRAFANA 상태')).toBe(true);
    });
  });

  // ==========================================================================
  // isVisionAgentAvailable() Tests
  // ==========================================================================

  describe('isVisionAgentAvailable()', () => {
    it('should return true when Gemini is available', async () => {
      const { isVisionAgentAvailable } = await import('./vision-agent');

      expect(isVisionAgentAvailable()).toBe(true);
    });

    // Note: Test for Gemini unavailability requires dynamic mock changes.
  });

  // ==========================================================================
  // getVisionAgentOrFallback() Tests
  // ==========================================================================

  describe('getVisionAgentOrFallback()', () => {
    it('should return VisionAgent when available', async () => {
      const { getVisionAgentOrFallback } = await import('./vision-agent');
      const { AgentFactory } = await import('./agent-factory');
      vi.spyOn(AgentFactory, 'isAvailable').mockReturnValue(true);

      const result = getVisionAgentOrFallback('스크린샷 분석해줘');

      expect(result.agent).not.toBeNull();
      expect(result.agent!.getName()).toBe('Vision Agent');
      expect(result.isFallback).toBe(false);
      expect(result.fallbackReason).toBeUndefined();
    });

    it('should fallback to Analyst Agent when vision is unavailable for a vision query', async () => {
      const { getVisionAgentOrFallback } = await import('./vision-agent');
      const { AgentFactory } = await import('./agent-factory');
      vi.spyOn(AgentFactory, 'isAvailable').mockReturnValue(false);

      const result = getVisionAgentOrFallback('스크린샷 분석해줘');

      expect(result.agent).not.toBeNull();
      expect(result.agent!.getName()).toBe('Analyst Agent');
      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toContain('Vision providers unavailable');
    });

    it('should return null agent when vision is unavailable for a non-vision query', async () => {
      const { getVisionAgentOrFallback } = await import('./vision-agent');
      const { AgentFactory } = await import('./agent-factory');
      vi.spyOn(AgentFactory, 'isAvailable').mockReturnValue(false);

      const result = getVisionAgentOrFallback('서버 상태 알려줘');

      expect(result.agent).toBeNull();
      expect(result.isFallback).toBe(false);
      expect(result.fallbackReason).toBeUndefined();
    });
  });

  // ==========================================================================
  // createVisionAgent() Tests
  // ==========================================================================

  describe('createVisionAgent()', () => {
    it('should return agent with Vision Agent name when Gemini is configured', async () => {
      const { createVisionAgent } = await import('./vision-agent');

      const agent = createVisionAgent();

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Vision Agent');
    });

    // Note: Test for Gemini unavailability requires dynamic mock changes.
  });

  // ==========================================================================
  // getVisionAgentConfig() Tests (Deprecated)
  // ==========================================================================

  describe('getVisionAgentConfig()', () => {
    it('should return config when available', async () => {
      const { getVisionAgentConfig } = await import('./vision-agent');

      const config = getVisionAgentConfig();

      expect(config).not.toBeNull();
      expect(config?.name).toBe('Vision Agent');
    });
  });

  // ==========================================================================
  // VisionAgent Class Tests
  // ==========================================================================

  describe('Vision Agent via AgentFactory', () => {
    it('should have correct name', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('vision');

      expect(agent).not.toBeNull();
      expect(agent!.getName()).toBe('Vision Agent');
    });

    it('should return config from AGENT_CONFIGS', async () => {
      const { AgentFactory } = await import('./agent-factory');

      const agent = AgentFactory.create('vision');
      const config = agent!.getConfig();

      expect(config).not.toBeNull();
      expect(config?.name).toBe('Vision Agent');
    });

    it('should check availability based on Gemini', async () => {
      const { AgentFactory } = await import('./agent-factory');

      expect(AgentFactory.isAvailable('vision')).toBe(true);
    });
  });

  // ==========================================================================
  // Vision Keywords Coverage Tests
  // ==========================================================================

  describe('Vision Keywords Coverage', () => {
    it('should detect all screenshot-related keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      const screenshotKeywords = [
        '스크린샷 보여줘',
        'screenshot 분석',
        '이미지 확인',
        'image 파일',
        '사진 분석',
        '그래프 확인',
        '차트 분석',
      ];

      for (const query of screenshotKeywords) {
        expect(isVisionQuery(query)).toBe(true);
      }
    });

    it('should detect all dashboard-related keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      const dashboardKeywords = [
        '대시보드 확인',
        'dashboard 분석',
        'grafana 화면',
        'cloudwatch 메트릭',
        'datadog 대시보드',
      ];

      for (const query of dashboardKeywords) {
        expect(isVisionQuery(query)).toBe(true);
      }
    });

    it('should detect URL and document keywords', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      const urlKeywords = [
        'url 분석',
        '링크 확인',
        '페이지 내용',
        '최신 문서',
        'documentation 찾기',
        '공식 가이드',
        'official docs',
      ];

      for (const query of urlKeywords) {
        expect(isVisionQuery(query)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('')).toBe(false);
    });

    it('should handle query with only whitespace', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('   ')).toBe(false);
    });

    it('should handle very long queries', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      const longQuery = '서버 상태 확인해주세요. '.repeat(100) + '스크린샷 분석';

      expect(isVisionQuery(longQuery)).toBe(true);
    });

    it('should handle special characters', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('스크린샷!@#$%')).toBe(true);
      expect(isVisionQuery('dashboard (grafana)')).toBe(true);
    });

    it('should handle mixed language queries', async () => {
      const { isVisionQuery } = await import('./vision-agent');

      expect(isVisionQuery('스크린샷 screenshot 분석해줘')).toBe(true);
      expect(isVisionQuery('Grafana 대시보드 확인')).toBe(true);
    });
  });
});
