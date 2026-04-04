import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckProviderStatus,
  mockGetCerebrasModel,
  mockGetGroqModel,
  mockGetMistralModel,
  mockGetGeminiFlashLiteModel,
  mockGetOpenRouterVisionModel,
  mockIsCerebrasToolCallingEnabled,
  mockIsOpenRouterVisionToolCallingEnabled,
} = vi.hoisted(() => ({
  mockCheckProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: true,
    openrouter: true,
  })),
  mockGetCerebrasModel: vi.fn((modelId: string) => ({ provider: 'cerebras', modelId })),
  mockGetGroqModel: vi.fn((modelId: string) => ({ provider: 'groq', modelId })),
  mockGetMistralModel: vi.fn((modelId: string) => ({ provider: 'mistral', modelId })),
  mockGetGeminiFlashLiteModel: vi.fn((modelId: string) => ({ provider: 'gemini', modelId })),
  mockGetOpenRouterVisionModel: vi.fn((modelId: string) => ({ provider: 'openrouter', modelId })),
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

vi.mock('../../../../lib/config-parser', () => ({
  getCerebrasModelId: vi.fn(() => 'cerebras-model'),
  getGroqModelId: vi.fn(() => 'groq-model'),
  getOpenRouterVisionModelId: vi.fn(() => 'openrouter-vision-model'),
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
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
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
  })),
}));

vi.mock('../../model-provider', () => ({
  checkProviderStatus: mockCheckProviderStatus,
  getCerebrasModel: mockGetCerebrasModel,
  getGeminiFlashLiteModel: mockGetGeminiFlashLiteModel,
  getGroqModel: mockGetGroqModel,
  getMistralModel: mockGetMistralModel,
  getOpenRouterVisionModel: mockGetOpenRouterVisionModel,
}));

import { selectTextModel } from './agent-model-selectors';

describe('selectTextModel capability requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckProviderStatus.mockReturnValue({
      cerebras: true,
      groq: true,
      mistral: true,
      gemini: true,
      openrouter: true,
    });
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
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
    expect(mockGetCerebrasModel).toHaveBeenCalledWith('cerebras-model');
  });
});
