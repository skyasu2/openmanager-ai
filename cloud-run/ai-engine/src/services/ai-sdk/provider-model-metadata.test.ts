import { afterEach, describe, expect, it } from 'vitest';
import {
  CEREBRAS_QWEN_DEPRECATION_DATE,
  DEFAULT_CEREBRAS_MODEL,
  DEPRECATED_CEREBRAS_QWEN_MODEL_ID,
} from '../../lib/config-parser';
import {
  getCerebrasModelMetadata,
  getDeprecatedRuntimeProviderModels,
  getRuntimeProviderModelMetadata,
} from './provider-model-metadata';

describe('provider model metadata', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('treats the default Cerebras model as the production GPT-OSS candidate', () => {
    delete process.env.CEREBRAS_MODEL_ID;

    const metadata = getCerebrasModelMetadata();

    expect(metadata.modelId).toBe(DEFAULT_CEREBRAS_MODEL);
    expect(metadata.lifecycle).toBe('production');
    expect(metadata.productionModel).toBe(true);
    expect(metadata.preview).toBe(false);
    expect(metadata.deprecated).toBe(false);
    expect(metadata.contextWindowTokens).toBe(131072);
  });

  it('flags the legacy Qwen preview model as deprecated with a replacement', () => {
    const metadata = getCerebrasModelMetadata(DEPRECATED_CEREBRAS_QWEN_MODEL_ID);

    expect(metadata.lifecycle).toBe('preview');
    expect(metadata.productionModel).toBe(false);
    expect(metadata.deprecated).toBe(true);
    expect(metadata.deprecationDate).toBe(CEREBRAS_QWEN_DEPRECATION_DATE);
    expect(metadata.recommendedReplacement).toBe(DEFAULT_CEREBRAS_MODEL);
    expect(getDeprecatedRuntimeProviderModels([metadata])).toEqual([
      {
        provider: 'cerebras',
        modelId: DEPRECATED_CEREBRAS_QWEN_MODEL_ID,
        severity: 'P1',
        reason: `${DEPRECATED_CEREBRAS_QWEN_MODEL_ID} is deprecated for cerebras after ${CEREBRAS_QWEN_DEPRECATION_DATE}`,
        replacement: DEFAULT_CEREBRAS_MODEL,
      },
    ]);
  });

  it('describes the current provider chain without deprecated runtime defaults', () => {
    delete process.env.CEREBRAS_MODEL_ID;

    const metadata = getRuntimeProviderModelMetadata();

    expect(metadata.map((entry) => entry.provider)).toEqual([
      'groq',
      'cerebras',
      'mistral',
      'gemini',
      'openrouter',
      'sambanova',
    ]);
    expect(getDeprecatedRuntimeProviderModels(metadata)).toEqual([]);
    expect(metadata.find((entry) => entry.provider === 'groq')).toMatchObject({
      modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
      lifecycle: 'production',
      productionModel: true,
      preview: false,
    });
    expect(metadata.find((entry) => entry.provider === 'sambanova')).toMatchObject({
      modelId: 'Meta-Llama-3.3-70B-Instruct',
      lifecycle: 'production',
      productionModel: true,
    });
    expect(metadata.find((entry) => entry.provider === 'gemini')).toMatchObject({
      modelId: 'gemini-2.5-flash-lite',
      role: 'vision primary',
    });
  });
});
