import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cerebrasModelCalls,
  mockCreateCerebras,
  mockCreateGemini,
  mockCreateGroq,
  mockCreateMistral,
  mockCreateOpenAI,
} = vi.hoisted(() => {
  const createModel = (provider: string, modelId: string) => ({
    specificationVersion: 'v1',
    provider,
    modelId,
    defaultObjectGenerationMode: 'json',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  });

  const cerebrasModelCalls: string[] = [];

  return {
    cerebrasModelCalls,
    mockCreateCerebras: vi.fn(() => (modelId: string) => {
      cerebrasModelCalls.push(modelId);
      return createModel('cerebras', modelId);
    }),
    mockCreateGroq: vi.fn(() => (modelId: string) =>
      createModel('groq', modelId)
    ),
    mockCreateMistral: vi.fn(() => (modelId: string) =>
      createModel('mistral', modelId)
    ),
    mockCreateGemini: vi.fn(() => (modelId: string) =>
      createModel('gemini', modelId)
    ),
    mockCreateOpenAI: vi.fn(() => (modelId: string) =>
      createModel('openrouter', modelId)
    ),
  };
});

vi.mock('@ai-sdk/cerebras', () => ({
  createCerebras: mockCreateCerebras,
}));

vi.mock('@ai-sdk/groq', () => ({
  createGroq: mockCreateGroq,
}));

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: mockCreateMistral,
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mockCreateGemini,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
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
  getOpenRouterApiKey: vi.fn(() => 'test-openrouter-key'),
  getUpstashConfig: vi.fn(() => null),
  getOpenRouterVisionModelId: vi.fn(() => 'google/gemma-3-27b-it:free'),
  getOpenRouterVisionFallbackModelIds: vi.fn(() => [
    'google/gemma-3-12b-it:free',
    'google/gemma-3-4b-it:free',
  ]),
  isCerebrasToolCallingEnabled: vi.fn(() => true),
  isCerebrasLongContextEnabled: vi.fn(() => true),
  isOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

import {
  getVerifierModel,
  invalidateProviderStatusCache,
  toggleProvider,
} from './model-provider';

describe('Verifier model context guard', () => {
  beforeEach(() => {
    cerebrasModelCalls.length = 0;
    invalidateProviderStatusCache();
    toggleProvider('cerebras', true);
    toggleProvider('groq', true);
    toggleProvider('mistral', true);
  });

  it('uses Mistral for Verifier long-context requirements and never probes 8K Cerebras', () => {
    const result = getVerifierModel();

    expect(result.provider).toBe('mistral');
    expect(result.modelId).toBe('mistral-small-latest');
    expect(cerebrasModelCalls).toEqual([]);
  });
});
