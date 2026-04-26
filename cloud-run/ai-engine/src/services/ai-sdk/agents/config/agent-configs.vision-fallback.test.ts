import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMockLanguageModel = (id: string) => ({
  modelId: id,
  specificationVersion: 'v1',
  provider: 'mock',
  defaultObjectGenerationMode: 'json',
  doGenerate: vi.fn(),
  doStream: vi.fn(),
});

vi.mock('./instructions', () => ({
  NLQ_INSTRUCTIONS: 'NLQ',
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
  detectAnomalies: { execute: vi.fn() },
  detectAnomaliesAllServers: { execute: vi.fn() },
  predictTrends: { execute: vi.fn() },
  analyzePattern: { execute: vi.fn() },
  correlateMetrics: { execute: vi.fn() },
  findRootCause: { execute: vi.fn() },
  buildIncidentTimeline: { execute: vi.fn() },
  getServerLogs: { execute: vi.fn() },
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
}));

vi.mock('../../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../lib/config-parser', () => ({
  getGroqApiKey: vi.fn(() => 'test-groq-key'),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getCerebrasModelId: vi.fn(() => 'cerebras-test-model'),
  getCerebrasFallbackModelIds: vi.fn(() => ['llama3.1-8b']),
  isCerebrasToolCallingEnabled: vi.fn(() => true),
  getGroqModelId: vi.fn(() => 'meta-llama/llama-4-scout-17b-16e-instruct'),
  getTavilyApiKey: vi.fn(() => null),
  getTavilyApiKeyBackup: vi.fn(() => null),
  getGeminiApiKey: vi.fn(() => null),
  getOpenRouterApiKey: vi.fn(() => 'test-openrouter-key'),
  getOpenRouterVisionModelId: vi.fn(() => 'google/gemma-3-27b-it:free'),
  getOpenRouterVisionFallbackModelIds: vi.fn(() => []),
  isOpenRouterVisionToolCallingEnabled: vi.fn(() => false),
}));

vi.mock('../../model-provider-status', () => ({
  checkProviderStatus: vi.fn(),
}));

vi.mock('../../model-provider-core', () => ({
  getCerebrasModel: vi.fn(),
  getGroqModel: vi.fn(),
  getMistralModel: vi.fn(),
  getGeminiFlashLiteModel: vi.fn(),
  getOpenRouterVisionModel: vi.fn(),
}));

import { getAgentConfig } from './agent-configs';
import { checkProviderStatus } from '../../model-provider-status';
import {
  getGeminiFlashLiteModel,
  getOpenRouterVisionModel,
} from '../../model-provider-core';
import { getOpenRouterVisionModelId } from '../../../../lib/config-parser';

describe('agent-configs vision fallback', () => {
  const visionConfig = getAgentConfig('Vision Agent');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Gemini first when Gemini is available', () => {
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: false,
      groq: false,
      mistral: false,
      gemini: true,
      openrouter: true,
    });
    vi.mocked(getGeminiFlashLiteModel).mockReturnValue(
      createMockLanguageModel('gemini-2.5-flash') as never
    );

    const model = visionConfig.getModel();

    expect(model).not.toBeNull();
    expect(model?.provider).toBe('gemini');
    expect(model?.modelId).toBe('gemini-2.5-flash-lite');
    expect(getOpenRouterVisionModel).not.toHaveBeenCalled();
  });

  it('falls back to OpenRouter when Gemini init fails', () => {
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: false,
      groq: false,
      mistral: false,
      gemini: true,
      openrouter: true,
    });
    vi.mocked(getGeminiFlashLiteModel).mockImplementation(() => {
      throw new Error('gemini unavailable');
    });
    vi.mocked(getOpenRouterVisionModelId).mockReturnValue(
      'google/gemma-3-27b-it:free'
    );
    vi.mocked(getOpenRouterVisionModel).mockReturnValue(
      createMockLanguageModel('google/gemma-3-27b-it:free') as never
    );

    const model = visionConfig.getModel();

    expect(model).not.toBeNull();
    expect(model?.provider).toBe('openrouter');
    expect(model?.modelId).toBe('google/gemma-3-27b-it:free');
    expect(getOpenRouterVisionModel).toHaveBeenCalledWith(
      'google/gemma-3-27b-it:free'
    );
  });

  it('uses OpenRouter when Gemini key is missing', () => {
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: false,
      groq: false,
      mistral: false,
      gemini: false,
      openrouter: true,
    });
    vi.mocked(getOpenRouterVisionModelId).mockReturnValue(
      'google/gemma-3-27b-it:free'
    );
    vi.mocked(getOpenRouterVisionModel).mockReturnValue(
      createMockLanguageModel('google/gemma-3-27b-it:free') as never
    );

    const model = visionConfig.getModel();

    expect(model).not.toBeNull();
    expect(model?.provider).toBe('openrouter');
  });

  it('returns null when both Gemini and OpenRouter are unavailable', () => {
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: true,
      groq: true,
      mistral: true,
      gemini: false,
      openrouter: false,
    });

    const model = visionConfig.getModel();

    expect(model).toBeNull();
  });

  it('returns null when Gemini unavailable and OpenRouter init throws', () => {
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: false,
      groq: false,
      mistral: false,
      gemini: false,
      openrouter: true,
    });
    vi.mocked(getOpenRouterVisionModelId).mockReturnValue(
      'google/gemma-3-27b-it:free'
    );
    vi.mocked(getOpenRouterVisionModel).mockImplementation(() => {
      throw new Error('openrouter init failed');
    });

    const model = visionConfig.getModel();

    expect(model).toBeNull();
  });

  it('full chain: all providers fail → getModel returns null', () => {
    // Config null → AgentFactory.isAvailable false → Analyst 라우팅
    // (Analyst 라우팅은 vision-agent.test.ts:262에서 이미 검증)
    vi.mocked(checkProviderStatus).mockReturnValue({
      cerebras: true,
      groq: true,
      mistral: true,
      gemini: false,
      openrouter: false,
    });

    expect(visionConfig.getModel()).toBeNull();
    expect(getGeminiFlashLiteModel).not.toHaveBeenCalled();
    expect(getOpenRouterVisionModel).not.toHaveBeenCalled();
  });
});
