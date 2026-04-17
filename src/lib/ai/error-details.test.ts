import { describe, expect, it } from 'vitest';
import {
  buildRateLimitErrorDetails,
  extractAIErrorDetailsFromPayload,
  getRateLimitScopeLabel,
  getRateLimitSourceLabel,
  inferAIErrorDetailsFromMessage,
} from './error-details';

describe('error-details', () => {
  it('builds frontend rate-limit details from response-like payload', () => {
    const details = buildRateLimitErrorDetails({
      body: {
        message: '요청이 너무 많습니다. 42초 후 다시 시도해주세요.',
        source: 'frontend-gateway',
        limitScope: 'minute',
        retryAfter: 42,
        remaining: 0,
        resetAt: 1234567890,
      },
    });

    expect(details.kind).toBe('rate-limit');
    expect(details.source).toBe('frontend-gateway');
    expect(details.scope).toBe('minute');
    expect(details.retryAfterSeconds).toBe(42);
    expect(details.remaining).toBe(0);
    expect(details.resetAt).toBe(1234567890);
  });

  it('infers daily rate-limit details from plain message', () => {
    const details = inferAIErrorDetailsFromMessage(
      '일일 요청 제한(100회)을 초과했습니다. 내일 다시 시도해주세요.'
    );

    expect(details).toMatchObject({
      kind: 'rate-limit',
      scope: 'daily',
      dailyLimitExceeded: true,
    });
  });

  it('infers cloud-run rate-limit source from message', () => {
    const details = inferAIErrorDetailsFromMessage(
      'Cloud Run AI 엔진 요청 제한으로 15초 후 다시 시도해주세요.'
    );

    expect(details).toMatchObject({
      kind: 'rate-limit',
      source: 'cloud-run-ai',
      retryAfterSeconds: 15,
    });
  });

  it('infers upstream provider rate-limit source from provider-named message', () => {
    const details = inferAIErrorDetailsFromMessage(
      'Groq 요청 제한으로 12초 후 다시 시도해주세요.'
    );

    expect(details).toMatchObject({
      kind: 'rate-limit',
      source: 'upstream-provider',
      retryAfterSeconds: 12,
    });
  });

  it('extracts structured rate-limit details from payload', () => {
    const details = extractAIErrorDetailsFromPayload({
      kind: 'rate-limit',
      message: '요청 제한을 초과했습니다. 12초 후 다시 시도해주세요.',
      source: 'cloud-run-ai',
      limitScope: 'minute',
      retryAfter: 12,
      remaining: 0,
      resetAt: 12345,
    });

    expect(details).toMatchObject({
      kind: 'rate-limit',
      source: 'cloud-run-ai',
      scope: 'minute',
      retryAfterSeconds: 12,
      remaining: 0,
      resetAt: 12345,
    });
  });

  it('returns readable labels', () => {
    expect(getRateLimitSourceLabel('frontend-gateway')).toBe(
      'frontend gateway'
    );
    expect(getRateLimitScopeLabel('daily')).toBe('오늘 한도');
  });
});
