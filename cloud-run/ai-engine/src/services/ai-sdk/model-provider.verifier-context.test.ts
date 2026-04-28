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
      if (modelId === 'qwen-3-235b-a22b-instruct-2507') {
        throw new Error('Qwen unavailable');
      }
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
  DEFAULT_CEREBRAS_MODEL: 'qwen-3-235b-a22b-instruct-2507',
  getCerebrasApiKey: vi.fn(() => 'test-cerebras-key'),
  getCerebrasModelId: vi.fn(() => 'qwen-3-235b-a22b-instruct-2507'),
  getCerebrasFallbackModelIds: vi.fn(() => ['llama3.1-8b']),
  getMistralApiKey: vi.fn(() => 'test-mistral-key'),
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

  it('skips the 8K Cerebras fallback when Qwen is unavailable', () => {
    const result = getVerifierModel();

    expect(result.provider).toBe('groq');
    expect(result.modelId).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(cerebrasModelCalls).toEqual(['qwen-3-235b-a22b-instruct-2507']);
    expect(cerebrasModelCalls).not.toContain('llama3.1-8b');
  });
});
