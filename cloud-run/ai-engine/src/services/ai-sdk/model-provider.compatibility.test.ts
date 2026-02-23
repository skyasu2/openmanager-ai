import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';

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
  getOpenRouterVisionModelId: vi.fn(() => 'nvidia/nemotron-nano-12b-v2-vl:free'),
  getOpenRouterVisionFallbackModelIds: vi.fn(() => [
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-4b-it:free',
  ]),
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
      getMistralModel('mistral-large-3-25-12'),
      getGeminiFlashLiteModel('gemini-2.5-flash'),
      getOpenRouterVisionModel('nvidia/nemotron-nano-12b-v2-vl:free'),
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
    expect(vision?.modelId).toBe('nvidia/nemotron-nano-12b-v2-vl:free');
  });

  it('configures OpenRouter provider with recommended headers and request patching', () => {
    getOpenRouterVisionModel('nvidia/nemotron-nano-12b-v2-vl:free');

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        headers: expect.objectContaining({
          'X-Title': 'OpenManager AI',
        }),
        fetch: expect.any(Function),
      })
    );
  });

  it('injects OpenRouter models fallback chain for vision requests', async () => {
    getOpenRouterVisionModel('nvidia/nemotron-nano-12b-v2-vl:free');

    const openrouterOptions = vi.mocked(createOpenAI).mock.calls.at(-1)?.[0];
    expect(openrouterOptions).toBeDefined();
    expect(openrouterOptions?.fetch).toBeTypeOf('function');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    );

    await openrouterOptions?.fetch?.('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    const patchedBody = fetchSpy.mock.calls.at(-1)?.[1]?.body;
    expect(typeof patchedBody).toBe('string');
    const payload = JSON.parse(patchedBody as string) as {
      provider: { allow_fallbacks: boolean; require_parameters: boolean };
      models: string[];
    };

    expect(payload.provider.allow_fallbacks).toBe(true);
    expect(payload.provider.require_parameters).toBe(true);
    expect(payload.models).toEqual([
      'nvidia/nemotron-nano-12b-v2-vl:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'google/gemma-3-4b-it:free',
    ]);

    fetchSpy.mockRestore();
  });

  it('returns null when both Vision providers are disabled', () => {
    toggleProvider('gemini', false);
    toggleProvider('openrouter', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).toBeNull();
  });
});
