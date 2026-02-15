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
  getOpenRouterVisionModelId: vi.fn(() => 'nvidia/nemotron-nano-12b-v2-vl:free'),
}));

vi.mock('../../model-provider', () => ({
  checkProviderStatus: vi.fn(),
  getCerebrasModel: vi.fn(),
  getGroqModel: vi.fn(),
  getMistralModel: vi.fn(),
  getGeminiFlashLiteModel: vi.fn(),
  getOpenRouterVisionModel: vi.fn(),
}));

import { AGENT_CONFIGS } from './agent-configs';
import {
  checkProviderStatus,
  getGeminiFlashLiteModel,
  getOpenRouterVisionModel,
} from '../../model-provider';
import { getOpenRouterVisionModelId } from '../../../../lib/config-parser';

describe('agent-configs vision fallback', () => {
  const visionConfig = AGENT_CONFIGS['Vision Agent'];

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
    expect(model?.modelId).toBe('gemini-2.5-flash');
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
      'nvidia/nemotron-nano-12b-v2-vl:free'
    );
    vi.mocked(getOpenRouterVisionModel).mockReturnValue(
      createMockLanguageModel('nvidia/nemotron-nano-12b-v2-vl:free') as never
    );

    const model = visionConfig.getModel();

    expect(model).not.toBeNull();
    expect(model?.provider).toBe('openrouter');
    expect(model?.modelId).toBe('nvidia/nemotron-nano-12b-v2-vl:free');
    expect(getOpenRouterVisionModel).toHaveBeenCalledWith(
      'nvidia/nemotron-nano-12b-v2-vl:free'
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
      'nvidia/nemotron-nano-12b-v2-vl:free'
    );
    vi.mocked(getOpenRouterVisionModel).mockReturnValue(
      createMockLanguageModel('nvidia/nemotron-nano-12b-v2-vl:free') as never
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
});
