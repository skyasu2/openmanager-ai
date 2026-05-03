import { describe, expect, it } from 'vitest';
import { sanitizeJobMetadataForClient } from './job-metadata';

describe('sanitizeJobMetadataForClient', () => {
  it('keeps provider telemetry while blocking client-forbidden metadata fragments', () => {
    const metadata = sanitizeJobMetadataForClient({
      ownerKey: 'owner-secret',
      complexity: 'complex',
      errorDetails: { raw: 'provider stack trace' },
      provider: 'mistral',
      modelId: 'mistral-small-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 801,
          error:
            'empty response Authorization: Bearer sk-test-1234567890abcdef',
        },
      ],
    });

    expect(metadata).toMatchObject({
      provider: 'mistral',
      modelId: 'mistral-small-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 801,
          error: 'empty response Authorization: Bearer [redacted-token]',
        },
      ],
    });

    const serialized = JSON.stringify(metadata);
    for (const forbidden of [
      'owner-secret',
      '"ownerKey"',
      '"complexity"',
      '"errorDetails"',
      'provider stack trace',
      'sk-test-1234567890abcdef',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps normalized routeDecision metadata for client diagnostics', () => {
    const metadata = sanitizeJobMetadataForClient({
      routeDecision: {
        intent: 'job',
        executionPath: 'job',
        complexity: 'complex',
        reasonCodes: ['complexity_threshold_exceeded'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'bff',
      },
    });

    expect(metadata?.routeDecision).toEqual({
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['complexity_threshold_exceeded'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'bff',
    });
  });
});
