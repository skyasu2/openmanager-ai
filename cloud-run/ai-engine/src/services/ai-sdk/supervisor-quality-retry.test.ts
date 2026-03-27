import { describe, expect, it } from 'vitest';
import type { SupervisorResponse } from './supervisor-types';
import { shouldRetryForQuality } from './supervisor-quality-retry';

function createResponseFixture(overrides?: Partial<SupervisorResponse>): SupervisorResponse {
  return {
    success: true,
    response: '정상 응답 본문입니다. 충분한 길이를 가지도록 작성한 테스트 문자열입니다.',
    toolsCalled: ['getServerMetrics'],
    toolResults: [],
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    metadata: {
      provider: 'cerebras',
      modelId: 'test-model',
      stepsExecuted: 1,
      durationMs: 1000,
      qualityFlags: [],
    },
    ...overrides,
  };
}

describe('shouldRetryForQuality', () => {
  it('does not retry for general intent even if quality flag exists', () => {
    const result = createResponseFixture({
      metadata: {
        provider: 'cerebras',
        modelId: 'test-model',
        stepsExecuted: 1,
        durationMs: 1000,
        qualityFlags: ['EMPTY_RESPONSE'],
      },
    });

    expect(shouldRetryForQuality(result, 'general')).toBe(false);
  });

  it('retries for hard failure flags on non-general intents', () => {
    const result = createResponseFixture({
      metadata: {
        provider: 'groq',
        modelId: 'test-model',
        stepsExecuted: 1,
        durationMs: 900,
        qualityFlags: ['NO_OUTPUT'],
      },
    });

    expect(shouldRetryForQuality(result, 'metrics')).toBe(true);
  });

  it('retries for too-short response when content is not meaningful', () => {
    const result = createResponseFixture({
      response: '짧은 응답',
      toolsCalled: [],
      metadata: {
        provider: 'groq',
        modelId: 'test-model',
        stepsExecuted: 1,
        durationMs: 1100,
        qualityFlags: ['TOO_SHORT'],
      },
    });

    expect(shouldRetryForQuality(result, 'anomaly')).toBe(true);
  });

  it('does not retry for too-short flag when response has meaningful content', () => {
    const result = createResponseFixture({
      response: 'TOO_SHORT 플래그가 있어도 실제 본문이 길고 도구 호출이 있으면 재시도하지 않습니다. 품질은 후속 관측 대상으로 남깁니다.',
      toolsCalled: ['detectAnomalies'],
      metadata: {
        provider: 'mistral',
        modelId: 'test-model',
        stepsExecuted: 2,
        durationMs: 1800,
        qualityFlags: ['TOO_SHORT'],
      },
    });

    expect(shouldRetryForQuality(result, 'prediction')).toBe(false);
  });

  it('does not retry when there are no quality flags', () => {
    const result = createResponseFixture();
    expect(shouldRetryForQuality(result, 'rca')).toBe(false);
  });
});

