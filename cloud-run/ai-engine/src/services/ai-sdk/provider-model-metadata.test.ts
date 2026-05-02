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
import {
  CEREBRAS_DEPRECATION_REPLACEMENT,
  CEREBRAS_LLAMA_DEPRECATION_DATE,
} from './provider-model-policy';

describe('provider model metadata', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('treats the default Cerebras model as llama3.1-8b production runtime', () => {
    delete process.env.CEREBRAS_MODEL_ID;

    const metadata = getCerebrasModelMetadata();

    expect(metadata.modelId).toBe(DEFAULT_CEREBRAS_MODEL);
    expect(metadata.modelId).toBe(CEREBRAS_LLAMA_FALLBACK_MODEL_ID);
    expect(metadata.role).toContain('primary');
    expect(metadata.lifecycle).toBe('production');
    expect(metadata.productionModel).toBe(true);
    expect(metadata.preview).toBe(false);
    expect(metadata.deprecated).toBe(false);
    expect(metadata.deprecationDate).toBe(CEREBRAS_LLAMA_DEPRECATION_DATE);
    expect(metadata.contextWindowTokens).toBe(8_192);
    expect(metadata.enabled).toBe(true);
    expect(metadata.toolCallingEnabled).toBe(true);
    expect(metadata.structuredOutputEnabled).toBe(true);
    expect(metadata.smokeStatus).toBe('green');
    expect(metadata.quota).toMatchObject({
      requestsPerMinute: 30,
      tokensPerMinute: 60_000,
      requestsPerDay: 14_400,
      tokensPerDay: 1_000_000,
    });
  });

  it('keeps Qwen as excluded preview metadata for explicit override detection', () => {
    const metadata = getCerebrasModelMetadata(CEREBRAS_QWEN_MODEL_ID);

    expect(metadata).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      role: 'excluded free-tier unavailable model',
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      deprecated: false,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      enabled: false,
      smokeStatus: 'red',
      recommendedReplacement: CEREBRAS_DEPRECATION_REPLACEMENT,
    });
  });

  it('keeps llama3.1-8b as production Cerebras metadata', () => {
    const metadata = getCerebrasModelMetadata(CEREBRAS_LLAMA_FALLBACK_MODEL_ID);

    expect(metadata).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      role: expect.stringContaining('primary'),
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      deprecationDate: CEREBRAS_LLAMA_DEPRECATION_DATE,
      enabled: true,
      smokeStatus: 'green',
    });
    expect(metadata.quota.requestsPerMinute).toBe(30);
    expect(metadata.quota.tokensPerMinute).toBe(60_000);
  });

  it('marks GPT-OSS as excluded from free-tier runtime candidates', () => {
    const metadata = getCerebrasModelMetadata(CEREBRAS_GPT_OSS_MODEL_ID);

    expect(metadata.role).toContain('excluded');
    expect(metadata.lifecycle).toBe('production');
    expect(metadata.productionModel).toBe(false);
    expect(metadata.enabled).toBe(false);
    expect(metadata.smokeStatus).toBe('red');
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
    expect(
      metadata.find((entry) => entry.modelId === CEREBRAS_LLAMA_FALLBACK_MODEL_ID)
    ).toMatchObject({
      modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      role: expect.stringContaining('primary'),
      lifecycle: 'production',
      smokeStatus: 'green',
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
        replacement: CEREBRAS_DEPRECATION_REPLACEMENT,
      },
    ]);
  });
});
