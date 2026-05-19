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
      provider: 'zai',
      modelId: _modelId,
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });
  }),
}));

vi.mock('../../lib/config-parser', () => ({
  CEREBRAS_QWEN_MODEL_ID: 'qwen-3-235b-a22b-instruct-2507',
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID: 'llama3.1-8b',
  CEREBRAS_QWEN_DEPRECATION_DATE: '2026-05-27',
  CEREBRAS_GPT_OSS_MODEL_ID: 'gpt-oss-120b',
  DEFAULT_CEREBRAS_MODEL: 'llama3.1-8b',
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
  getCerebrasFallbackModelIds: vi.fn((): string[] => []),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
  getMistralModelId: vi.fn(() => 'mistral-small-latest'),
  getZaiApiKey: vi.fn(() => 'test-zai-key'),
  getZaiBaseUrl: vi.fn(() => 'https://api.z.ai/api/paas/v4'),
  getZaiModelId: vi.fn(() => 'glm-4.5-flash'),
  getZaiVisionModelId: vi.fn(() => 'glm-4.6v-flash'),
  getGroqApiKey: vi.fn(() => 'test-groq-key'),
  getGroqModelId: vi.fn(() => 'meta-llama/llama-4-scout-17b-16e-instruct'),
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
  getUpstashConfig: vi.fn(() => null),
  isCerebrasToolCallingEnabled: vi.fn(() => true),
  isCerebrasLongContextEnabled: vi.fn(() => true),
}));

import {
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getZaiModel,
  getZaiVisionModel,
  getSupervisorModel,
  getVerifierModel,
  getVisionAgentModel,
  invalidateProviderStatusCache,
  toggleProvider,
} from './model-provider';
import { resetRoundRobinCursor } from './agents/config/round-robin-provider-selector';

describe('model-provider compatibility (SDK upgrades)', () => {
  beforeEach(() => {
    resetRoundRobinCursor();
    invalidateProviderStatusCache();
    toggleProvider('cerebras', true);
    toggleProvider('groq', true);
    toggleProvider('mistral', true);
    toggleProvider('zai', true);
    toggleProvider('gemini', true);
  });

  it('creates all provider models with LanguageModel shape', () => {
    const models = [
      getCerebrasModel('gpt-oss-120b'),
      getGroqModel('meta-llama/llama-4-scout-17b-16e-instruct'),
      getMistralModel('mistral-large-latest'),
      getZaiModel('glm-4.5-flash'),
      getZaiVisionModel('glm-4.6v-flash'),
      getGeminiFlashLiteModel('gemini-2.5-flash-lite'),
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
    expect(vision?.modelId).toBe('gemini-2.5-flash-lite');
  });

  it('rotates Supervisor and Verifier across the text provider mesh', () => {
    const supervisor = getSupervisorModel();
    const verifier = getVerifierModel();

    expect(supervisor.provider).toBe('groq');
    expect(supervisor.rotationSlot).toBe(0);
    expect(verifier.provider).toBe('mistral');
    expect(verifier.rotationSlot).toBe(1);

    toggleProvider('cerebras', false);
    invalidateProviderStatusCache();

    const nextVerifier = getVerifierModel();
    expect(nextVerifier.provider).toBe('zai');
    expect(nextVerifier.rotationSlot).toBe(2);
  });

  it('falls back to Z.AI Vision when Gemini is disabled', () => {
    toggleProvider('gemini', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).not.toBeNull();
    expect(vision?.provider).toBe('zai');
    expect(vision?.modelId).toBe('glm-4.6v-flash');
  });

  it('returns null when Gemini and Z.AI Vision are disabled', () => {
    toggleProvider('gemini', false);
    toggleProvider('zai', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).toBeNull();
  });

  it('injects Z.AI thinking disabled for free Flash requests', async () => {
    getZaiModel('glm-4.5-flash');

    const zaiOptions = vi
      .mocked(createOpenAI)
      .mock.calls.find((call) => call[0]?.name === 'zai')?.[0];
    expect(zaiOptions).toBeDefined();
    expect(zaiOptions?.fetch).toBeTypeOf('function');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    );

    await zaiOptions?.fetch?.('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'glm-4.5-flash',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    const patchedBody = fetchSpy.mock.calls.at(-1)?.[1]?.body;
    expect(typeof patchedBody).toBe('string');
    const payload = JSON.parse(patchedBody as string) as {
      thinking: { type: string };
    };

    expect(payload.thinking).toEqual({ type: 'disabled' });
    fetchSpy.mockRestore();
  });

  it('returns null when all Vision providers are disabled', () => {
    toggleProvider('gemini', false);
    toggleProvider('zai', false);
    invalidateProviderStatusCache();

    const vision = getVisionAgentModel();
    expect(vision).toBeNull();
  });
});
