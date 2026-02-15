import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/cerebras', () => ({
  createCerebras: vi.fn(() => {
    return (_modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'cerebras',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn(() => {
    return (_modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'groq',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: vi.fn(() => {
    return (_modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'mistral',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => {
    return (_modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'gemini',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    return (_modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'openrouter',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
  getGroqApiKey: vi.fn(() => 'test-groq-key'),
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
  getOpenRouterApiKey: vi.fn(() => 'test-openrouter-key'),
  getOpenRouterVisionModelId: vi.fn(() => 'qwen/qwen-2.5-vl-72b-instruct:free'),
}));

import {
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
  getVisionAgentModel,
  invalidateProviderStatusCache,
  toggleProvider,
} from './model-provider';

describe('model-provider compatibility (SDK upgrades)', () => {
  beforeEach(() => {
    invalidateProviderStatusCache();
    toggleProvider('cerebras', true);
    toggleProvider('groq', true);
    toggleProvider('mistral', true);
    toggleProvider('gemini', true);
    toggleProvider('openrouter', true);
  });

  it('creates all provider models with LanguageModel shape', () => {
    const models = [
      getCerebrasModel('llama-3.3-70b'),
      getGroqModel('llama-3.3-70b-versatile'),
      getMistralModel('mistral-small-2506'),
      getGeminiFlashLiteModel('gemini-2.5-flash'),
      getOpenRouterVisionModel('qwen/qwen-2.5-vl-72b-instruct:free'),
    ];

    for (const model of models) {
      expect(typeof (model as { doGenerate: unknown }).doGenerate).toBe('function');
      expect(typeof (model as { doStream: unknown }).doStream).toBe('function');
    }
  });

  it('chooses Gemini as Vision primary when both providers are enabled', () => {
    const vision = getVisionAgentModel();
    expect(vision).not.toBeNull();
    expect(vision?.provider).toBe('gemini');
    expect(vision?.modelId).toBe('gemini-2.5-flash');
  });

  it('falls back to OpenRouter when Gemini is disabled', () => {
    toggleProvider('gemini', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).not.toBeNull();
    expect(vision?.provider).toBe('openrouter');
    expect(vision?.modelId).toBe('qwen/qwen-2.5-vl-72b-instruct:free');
  });

  it('returns null when both Vision providers are disabled', () => {
    toggleProvider('gemini', false);
    toggleProvider('openrouter', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).toBeNull();
  });
});
