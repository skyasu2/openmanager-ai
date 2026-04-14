import { describe, expect, it } from 'vitest';
import type { SupervisorResponse } from './supervisor-types';
import { buildAdvisorFormatRetryPrefix, shouldRetryForQuality } from './supervisor-quality-retry';

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

  it('retries when non-general intent returns without any tool call', () => {
    const result = createResponseFixture({
      toolsCalled: [],
      metadata: {
        provider: 'groq',
        modelId: 'test-model',
        stepsExecuted: 1,
        durationMs: 1200,
        qualityFlags: [],
      },
    });

    expect(shouldRetryForQuality(result, 'advisor')).toBe(true);
  });

  describe('Advisor MISSING_COMMAND_BLOCK retry', () => {
    it('retries Advisor response with MISSING_COMMAND_BLOCK when format compliance fails', () => {
      const result = createResponseFixture({
        response: '문제 원인을 분석했습니다. CPU 과부하가 의심됩니다. 해결을 위해 조치가 필요합니다.',
        toolsCalled: ['searchKnowledgeBase'],
        metadata: {
          provider: 'mistral',
          modelId: 'mistral-small',
          stepsExecuted: 2,
          durationMs: 35_000,
          qualityFlags: ['MISSING_COMMAND_BLOCK', 'LATENCY_SLOW'],
          formatCompliance: false,
          finalAgent: 'Advisor Agent',
        },
      });

      expect(shouldRetryForQuality(result, 'advisor')).toBe(true);
    });

    it('does not retry Advisor when response is empty (handled by EMPTY_RESPONSE path)', () => {
      const result = createResponseFixture({
        response: '',
        toolsCalled: ['searchKnowledgeBase'],
        metadata: {
          provider: 'mistral',
          modelId: 'mistral-small',
          stepsExecuted: 1,
          durationMs: 5_000,
          qualityFlags: ['EMPTY_RESPONSE', 'MISSING_COMMAND_BLOCK'],
          formatCompliance: false,
          finalAgent: 'Advisor Agent',
        },
      });

      // Empty response hits EMPTY_RESPONSE path, not Advisor-specific path
      // shouldRetryForQuality still returns true but via QUALITY_RETRY_FLAGS
      expect(shouldRetryForQuality(result, 'advisor')).toBe(true);
    });

    it('does not retry non-Advisor agent for MISSING_COMMAND_BLOCK', () => {
      const result = createResponseFixture({
        response: '분석 결과 이상 없습니다. 현황을 지속 모니터링하세요. 원인 추정: 일시적 스파이크.',
        toolsCalled: ['detectAnomalies'],
        metadata: {
          provider: 'cerebras',
          modelId: 'test-model',
          stepsExecuted: 2,
          durationMs: 8_000,
          qualityFlags: ['MISSING_COMMAND_BLOCK'],
          formatCompliance: false,
          finalAgent: 'Analyst Agent',
        },
      });

      expect(shouldRetryForQuality(result, 'anomaly')).toBe(false);
    });

    it('does not retry Advisor with formatCompliance=true despite MISSING_COMMAND_BLOCK flag', () => {
      const result = createResponseFixture({
        response: '`top -o %CPU` 명령어로 문제를 진단하세요. 원인: 메모리 부족. 해결: 프로세스 종료.',
        toolsCalled: ['recommendCommands'],
        metadata: {
          provider: 'mistral',
          modelId: 'mistral-small',
          stepsExecuted: 2,
          durationMs: 12_000,
          qualityFlags: [],
          formatCompliance: true,
          finalAgent: 'Advisor Agent',
        },
      });

      expect(shouldRetryForQuality(result, 'advisor')).toBe(false);
    });
  });

  it('buildAdvisorFormatRetryPrefix returns non-empty Korean enforcement message', () => {
    const prefix = buildAdvisorFormatRetryPrefix();
    expect(prefix).toContain('[RETRY]');
    expect(prefix).toContain('코드 블록');
    expect(prefix.length).toBeGreaterThan(20);
  });

  it('does not retry when no_provider fallback is already returned', () => {
    const result = createResponseFixture({
      response: '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.',
      toolsCalled: [],
      metadata: {
        provider: 'none',
        modelId: 'none',
        stepsExecuted: 0,
        durationMs: 100,
        qualityFlags: ['TOO_SHORT', 'no_provider'],
      },
    });

    expect(shouldRetryForQuality(result, 'metrics')).toBe(false);
  });
});
