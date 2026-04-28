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

vi.mock('../../../../tools-ai-sdk', () => ({
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
}));

vi.mock('../../model-provider-status', () => ({
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: true,
    openrouter: true,
  })),
}));

vi.mock('../../model-provider-core', () => ({
  getCerebrasModel: vi.fn(),
  getGroqModel: vi.fn(),
  getMistralModel: vi.fn(),
  getGeminiFlashLiteModel: vi.fn(),
  getOpenRouterVisionModel: vi.fn(),
}));

vi.mock('../../../../lib/config-parser', () => ({
  getGroqApiKey: vi.fn(() => 'test-groq-key'),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getCerebrasModelId: vi.fn(() => 'qwen-3-235b-a22b-instruct-2507'),
  getCerebrasFallbackModelIds: vi.fn(() => ['llama3.1-8b']),
  getGroqModelId: vi.fn(() => 'meta-llama/llama-4-scout-17b-16e-instruct'),
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
  getOpenRouterApiKey: vi.fn(() => 'test-openrouter-key'),
  getOpenRouterVisionModelId: vi.fn(() => 'google/gemma-3-27b-it:free'),
  getOpenRouterVisionFallbackModelIds: vi.fn(() => []),
  isCerebrasToolCallingEnabled: vi.fn(() => true),
  isCerebrasLongContextEnabled: vi.fn(() => true),
  isOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

import { getAgentConfig, getAgentInstructions } from './agent-configs';

describe('agent-configs NLQ instruction layering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves NLQ instructions dynamically from the user query', () => {
    const nlqConfig = getAgentConfig('NLQ Agent');

    expect(nlqConfig.getInstructions).toBeTypeOf('function');
    expect(getAgentInstructions(nlqConfig, 'CPU가 가장 높은 서버')).toBe(
      'dynamic NLQ: CPU가 가장 높은 서버'
    );
    expect(mockGetNlqInstructions).toHaveBeenCalledWith('CPU가 가장 높은 서버');
  });

  it('keeps static instructions for non-NLQ agents', () => {
    const advisorConfig = getAgentConfig('Advisor Agent');

    expect(advisorConfig.getInstructions).toBeUndefined();
    expect(getAgentInstructions(advisorConfig, '해결 방법 알려줘')).toBe('ADVISOR');
  });
});
