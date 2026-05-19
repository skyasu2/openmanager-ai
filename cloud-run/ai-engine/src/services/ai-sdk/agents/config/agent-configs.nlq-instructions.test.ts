import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetNlqInstructions } = vi.hoisted(() => ({
  mockGetNlqInstructions: vi.fn((query: string) => `dynamic NLQ: ${query}`),
}));

vi.mock('./instructions', () => ({
  NLQ_INSTRUCTIONS: 'legacy NLQ',
  getNlqInstructions: mockGetNlqInstructions,
  ANALYST_INSTRUCTIONS: 'ANALYST',
  REPORTER_INSTRUCTIONS: 'REPORTER',
  ADVISOR_INSTRUCTIONS: 'ADVISOR',
  VISION_INSTRUCTIONS: 'VISION',
}));

vi.mock('../../../../tools-ai-sdk', () => {
  const tools = {
    getServerMetrics: { execute: vi.fn() },
    getServerMetricsAdvanced: { execute: vi.fn() },
    filterServers: { execute: vi.fn() },
    getServerByGroup: { execute: vi.fn() },
    getServerByGroupAdvanced: { execute: vi.fn() },
    getServerLogs: { execute: vi.fn() },
    detectAnomalies: { execute: vi.fn() },
    detectAnomaliesAllServers: { execute: vi.fn() },
    predictTrends: { execute: vi.fn() },
    analyzePattern: { execute: vi.fn() },
    correlateMetrics: { execute: vi.fn() },
    findRootCause: { execute: vi.fn() },
    buildIncidentTimeline: { execute: vi.fn() },
    searchKnowledgeBase: { execute: vi.fn() },
    recommendCommands: { execute: vi.fn() },
    searchWeb: { execute: vi.fn() },
    evaluateIncidentReport: { execute: vi.fn() },
    validateReportStructure: { execute: vi.fn() },
    scoreRootCauseConfidence: { execute: vi.fn() },
    refineRootCauseAnalysis: { execute: vi.fn() },
    enhanceSuggestedActions: { execute: vi.fn() },
    extendServerCorrelation: { execute: vi.fn() },
    finalAnswer: { execute: vi.fn() },
    analyzeScreenshot: { execute: vi.fn() },
    analyzeLargeLog: { execute: vi.fn() },
    searchWithGrounding: { execute: vi.fn() },
    analyzeUrlContent: { execute: vi.fn() },
    evaluateMathExpression: { execute: vi.fn() },
    computeSeriesStats: { execute: vi.fn() },
    estimateCapacityProjection: { execute: vi.fn() },
  };

  return {
    ...tools,
    allTools: tools,
  };
});

vi.mock('../../model-provider-status', () => ({
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: true,
  })),
}));

vi.mock('../../model-provider-core', () => ({
  getCerebrasModel: vi.fn(),
  getGroqModel: vi.fn(),
  getMistralModel: vi.fn(),
  getZaiModel: vi.fn(),
  getZaiVisionModel: vi.fn(),
  getGeminiFlashLiteModel: vi.fn(),
}));

vi.mock('../../../../lib/config-parser', () => ({
  getGroqApiKey: vi.fn(() => 'test-groq-key'),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getZaiApiKey: vi.fn(() => 'test-zai-key'),
  getCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
  getCerebrasFallbackModelIds: vi.fn((): string[] => []),
  getZaiModelId: vi.fn(() => 'glm-4.5-flash'),
  getZaiVisionModelId: vi.fn(() => 'glm-4.6v-flash'),
  getGroqModelId: vi.fn(() => 'meta-llama/llama-4-scout-17b-16e-instruct'),
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
  isCerebrasToolCallingEnabled: vi.fn(() => true),
  isCerebrasLongContextEnabled: vi.fn(() => true),
}));

import { getAgentConfig, getAgentInstructions } from './agent-configs';

describe('agent-configs Metrics Query instruction layering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Metrics Query instructions dynamically from the user query', () => {
    const nlqConfig = getAgentConfig('Metrics Query Agent');

    expect(nlqConfig.getInstructions).toBeTypeOf('function');
    expect(getAgentInstructions(nlqConfig, 'CPU가 가장 높은 서버')).toBe(
      'dynamic NLQ: CPU가 가장 높은 서버'
    );
    expect(mockGetNlqInstructions).toHaveBeenCalledWith('CPU가 가장 높은 서버');
  });

  it('resolves legacy NLQ Agent config key as Metrics Query', () => {
    expect(getAgentConfig('NLQ Agent')?.name).toBe('Metrics Query Agent');
  });

  it('keeps static instructions for non-Metrics Query agents', () => {
    const advisorConfig = getAgentConfig('Advisor Agent');

    expect(advisorConfig.getInstructions).toBeUndefined();
    expect(getAgentInstructions(advisorConfig, '해결 방법 알려줘')).toBe('ADVISOR');
  });
});
