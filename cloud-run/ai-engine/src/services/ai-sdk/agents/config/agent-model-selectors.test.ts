import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckProviderStatus,
  mockGetCerebrasModel,
  mockGetGroqModel,
  mockGetMistralModel,
  mockGetZaiModel,
  mockGetZaiVisionModel,
  mockGetGeminiFlashLiteModel,
  mockGetOpenRouterVisionModel,
  mockGetCerebrasModelId,
  mockGetCerebrasFallbackModelIds,
  mockIsCerebrasToolCallingEnabled,
  mockIsOpenRouterVisionToolCallingEnabled,
  mockGetCircuitBreaker,
} = vi.hoisted(() => ({
  mockCheckProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    zai: true,
    gemini: true,
    openrouter: true,
  })),
  mockGetCerebrasModel: vi.fn((modelId: string) => ({ provider: 'cerebras', modelId })),
  mockGetGroqModel: vi.fn((modelId: string) => ({ provider: 'groq', modelId })),
  mockGetMistralModel: vi.fn((modelId: string) => ({ provider: 'mistral', modelId })),
  mockGetZaiModel: vi.fn((modelId: string) => ({ provider: 'zai', modelId })),
  mockGetZaiVisionModel: vi.fn((modelId: string) => ({ provider: 'zai', modelId })),
  mockGetGeminiFlashLiteModel: vi.fn((modelId: string) => ({ provider: 'gemini', modelId })),
  mockGetOpenRouterVisionModel: vi.fn((modelId: string) => ({ provider: 'openrouter', modelId })),
  mockGetCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
  mockGetCerebrasFallbackModelIds: vi.fn((): string[] => []),
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
  mockGetCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
  })),
}));

vi.mock('../../../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
  getCerebrasFallbackModelIds: mockGetCerebrasFallbackModelIds,
  getGroqModelId: vi.fn(() => 'groq-model'),
  getMistralModelId: vi.fn(() => 'mistral-small-latest'),
  getZaiModelId: vi.fn(() => 'glm-4.5-flash'),
  getZaiVisionModelId: vi.fn(() => 'glm-4.6v-flash'),
  getOpenRouterVisionModelId: vi.fn(() => 'openrouter-vision-model'),
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isCerebrasLongContextEnabled: vi.fn(() => true),
  isOpenRouterVisionFallbackEnabled: vi.fn(() => false),
  isOpenRouterVisionToolCallingEnabled: mockIsOpenRouterVisionToolCallingEnabled,
}));

vi.mock('../../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../resilience/circuit-breaker', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

vi.mock('../../model-provider-core', () => ({
  getCerebrasModel: mockGetCerebrasModel,
  getGeminiFlashLiteModel: mockGetGeminiFlashLiteModel,
  getGroqModel: mockGetGroqModel,
  getMistralModel: mockGetMistralModel,
  getZaiModel: mockGetZaiModel,
  getZaiVisionModel: mockGetZaiVisionModel,
  getOpenRouterVisionModel: mockGetOpenRouterVisionModel,
}));

vi.mock('../../model-provider-status', () => ({
  checkProviderStatus: mockCheckProviderStatus,
}));

import {
  getAdvisorModel,
  getAnalystModel,
  getNlqModel,
  getReporterModel,
  selectTextModel,
} from './agent-model-selectors';
import { resetRoundRobinCursor } from './round-robin-provider-selector';

describe('selectTextModel capability requirements', () => {
  beforeEach(() => {
    resetRoundRobinCursor();
    vi.clearAllMocks();
    mockCheckProviderStatus.mockReturnValue({
      cerebras: true,
      groq: true,
      mistral: true,
      zai: true,
      gemini: true,
      openrouter: true,
    });
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
    mockGetCerebrasModelId.mockReturnValue('llama3.1-8b');
    mockGetCerebrasFallbackModelIds.mockReturnValue([]);
    mockGetCerebrasModel.mockImplementation((modelId: string) => ({ provider: 'cerebras', modelId }));
    mockGetCircuitBreaker.mockImplementation(() => ({
      isAllowed: () => true,
    }));
  });

  it('skips providers that do not satisfy required tool-calling support', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);

    const result = selectTextModel('Test Agent', ['cerebras', 'groq'], {
      requiredCapabilities: { requireToolCalling: true },
    });

    expect(result?.provider).toBe('groq');
    expect(mockGetCerebrasModel).not.toHaveBeenCalled();
    expect(mockGetGroqModel).toHaveBeenCalledWith('groq-model');
  });

  it('returns null when no provider satisfies the requested capabilities', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);
    mockCheckProviderStatus.mockReturnValue({
      cerebras: true,
      groq: false,
      mistral: false,
      zai: false,
      gemini: false,
      openrouter: false,
    });

    const result = selectTextModel('Test Agent', ['cerebras'], {
      requiredCapabilities: { requireToolCalling: true },
    });

    expect(result).toBeNull();
    expect(mockGetCerebrasModel).not.toHaveBeenCalled();
  });

  it('still allows capability-relaxed paths to use Cerebras', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);

    const result = selectTextModel('Test Agent', ['cerebras']);

    expect(result?.provider).toBe('cerebras');
    expect(mockGetCerebrasModel).toHaveBeenCalledWith('llama3.1-8b');
  });

  it('tries a configured intra-Cerebras fallback when a custom primary model init fails', () => {
    mockGetCerebrasModelId.mockReturnValue('custom-cerebras-model');
    mockGetCerebrasFallbackModelIds.mockReturnValue(['llama3.1-8b']);
    mockGetCerebrasModel.mockImplementation((modelId: string) => {
      if (modelId === 'custom-cerebras-model') {
        throw new Error('custom model unavailable');
      }
      return { provider: 'cerebras', modelId };
    });

    const result = selectTextModel('Test Agent', ['cerebras', 'groq'], {
      requiredCapabilities: { requireToolCalling: true },
    });

    expect(result?.provider).toBe('cerebras');
    expect(result?.modelId).toBe('llama3.1-8b');
    expect(mockGetCerebrasModel).toHaveBeenNthCalledWith(1, 'custom-cerebras-model');
    expect(mockGetCerebrasModel).toHaveBeenNthCalledWith(2, 'llama3.1-8b');
    expect(mockGetGroqModel).not.toHaveBeenCalled();
  });

  it('skips the default 8K Cerebras runtime for long-context requirements', () => {
    const result = selectTextModel('Test Agent', ['cerebras', 'groq'], {
      requiredCapabilities: { requireLongContext: true },
    });

    expect(result?.provider).toBe('groq');
    expect(mockGetCerebrasModel).not.toHaveBeenCalled();
    expect(mockGetGroqModel).toHaveBeenCalledWith('groq-model');
  });

  it('rotates long-context agent groups across the text mesh when Cerebras is 8K', () => {
    const nlq = getNlqModel();
    const advisor = getAdvisorModel();
    const analyst = getAnalystModel();
    const reporter = getReporterModel();

    expect(nlq?.provider).toBe('groq');
    expect(nlq?.rotationSlot).toBe(0);
    expect(advisor?.provider).toBe('mistral');
    expect(advisor?.rotationSlot).toBe(1);
    expect(analyst?.provider).toBe('zai');
    expect(analyst?.rotationSlot).toBe(2);
    expect(reporter?.provider).toBe('groq');
    expect(reporter?.rotationSlot).toBe(3);
    expect(mockGetCerebrasModel).not.toHaveBeenCalledWith('llama3.1-8b');
  });

  it('moves Metrics Query to the next available rotation provider when Groq is unavailable', () => {
    mockCheckProviderStatus.mockReturnValue({
      cerebras: true,
      groq: false,
      mistral: true,
      zai: true,
      gemini: true,
      openrouter: true,
    });

    const result = getNlqModel();

    expect(result?.provider).toBe('mistral');
    expect(result?.rotationSlot).toBe(0);
    expect(mockGetCerebrasModel).not.toHaveBeenCalled();
    expect(mockGetCerebrasModel).not.toHaveBeenCalledWith('llama3.1-8b');
    expect(mockGetMistralModel).toHaveBeenCalledWith('mistral-small-latest');
  });

  it('keeps Analyst, Reporter, and Advisor on models with at least 32K context', () => {
    const results = [
      getAnalystModel(),
      getReporterModel(),
      getAdvisorModel(),
    ];

    expect(results.map((result) => result?.provider)).toEqual([
      'groq',
      'mistral',
      'zai',
    ]);
    expect(results.map((result) => result?.rotationSlot)).toEqual([0, 1, 2]);
    expect(mockGetCerebrasModel).not.toHaveBeenCalled();
    expect(mockGetCerebrasModel).not.toHaveBeenCalledWith('llama3.1-8b');
    expect(mockGetMistralModel).toHaveBeenCalledWith('mistral-small-latest');
  });

  it('keeps Analyst and Reporter on available long-context providers when Cerebras is unavailable', () => {
    mockCheckProviderStatus.mockReturnValue({
      cerebras: false,
      groq: true,
      mistral: true,
      zai: true,
      gemini: true,
      openrouter: true,
    });

    expect(getAnalystModel()?.provider).toBe('groq');
    expect(getReporterModel()?.provider).toBe('mistral');
  });

  it('uses agent-specific circuit breaker keys for the same provider', () => {
    mockGetCircuitBreaker.mockImplementation((key: string) => ({
      isAllowed: () => key !== 'metrics-query-agent-groq',
    }));

    const nlqResult = selectTextModel(
      'Metrics Query Agent',
      ['groq', 'cerebras'],
      { requiredCapabilities: { requireToolCalling: true } }
    );
    const analystResult = selectTextModel(
      'Analyst Agent',
      ['groq', 'cerebras'],
      { requiredCapabilities: { requireToolCalling: true } }
    );

    expect(nlqResult?.provider).toBe('cerebras');
    expect(analystResult?.provider).toBe('groq');
    expect(mockGetCircuitBreaker).toHaveBeenCalledWith(
      'metrics-query-agent-groq'
    );
    expect(mockGetCircuitBreaker).toHaveBeenCalledWith('analyst-agent-groq');
  });
});
