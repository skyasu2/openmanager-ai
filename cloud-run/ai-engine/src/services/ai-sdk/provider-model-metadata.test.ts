import { afterEach, describe, expect, it } from 'vitest';
import {
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
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

  it('treats the default Cerebras model as Qwen primary until deprecation date', () => {
    delete process.env.CEREBRAS_MODEL_ID;

    const metadata = getCerebrasModelMetadata();

    expect(metadata.modelId).toBe(DEFAULT_CEREBRAS_MODEL);
    expect(metadata.modelId).toBe(CEREBRAS_QWEN_MODEL_ID);
    expect(metadata.role).toContain('primary');
    expect(metadata.lifecycle).toBe('preview');
    expect(metadata.productionModel).toBe(false);
    expect(metadata.preview).toBe(true);
    expect(metadata.deprecated).toBe(false);
    expect(metadata.deprecationDate).toBe(CEREBRAS_QWEN_DEPRECATION_DATE);
    expect(metadata.recommendedReplacement).toBe(CEREBRAS_LLAMA_FALLBACK_MODEL_ID);
    expect(metadata.contextWindowTokens).toBe(65_536);
  });

  it('keeps llama3.1-8b as intra-Cerebras fallback metadata only', () => {
    const metadata = getCerebrasModelMetadata(CEREBRAS_LLAMA_FALLBACK_MODEL_ID);

    expect(metadata).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      role: 'intra-Cerebras fallback',
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
    });
  });

  it('marks GPT-OSS as excluded from free-tier runtime candidates', () => {
    const metadata = getCerebrasModelMetadata(CEREBRAS_GPT_OSS_MODEL_ID);

    expect(metadata.role).toContain('excluded');
    expect(metadata.lifecycle).toBe('custom');
    expect(metadata.productionModel).toBe(false);
    expect(metadata.freeTierLimitSummary).toContain('not in free-tier runtime');
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
    ]);
    expect(getDeprecatedRuntimeProviderModels(metadata)).toEqual([]);
    expect(metadata.find((entry) => entry.provider === 'groq')).toMatchObject({
      modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
    });
    expect(metadata.find((entry) => entry.provider === 'cerebras')).toMatchObject({
      modelId: CEREBRAS_QWEN_MODEL_ID,
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      recommendedReplacement: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
    });
    expect(metadata.find((entry) => entry.provider === 'gemini')).toMatchObject({
      modelId: 'gemini-2.5-flash-lite',
      role: 'vision primary',
    });
  });

  it('flags Qwen as deprecated only after the scheduled deprecation date', () => {
    const metadata = [getCerebrasModelMetadata(CEREBRAS_QWEN_MODEL_ID)];

    expect(getDeprecatedRuntimeProviderModels(metadata, new Date('2026-04-26T00:00:00Z'))).toEqual([]);
    expect(getDeprecatedRuntimeProviderModels(metadata, new Date('2026-05-28T00:00:00Z'))).toEqual([
      {
        provider: 'cerebras',
        modelId: CEREBRAS_QWEN_MODEL_ID,
        severity: 'P1',
        reason: `${CEREBRAS_QWEN_MODEL_ID} is deprecated for cerebras after ${CEREBRAS_QWEN_DEPRECATION_DATE}`,
        replacement: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      },
    ]);
  });
});
