import { describe, expect, it } from 'vitest';
import {
  extractClientKeyFromHeaders,
  RATE_LIMIT_IDENTITY_HEADER,
} from './rate-limiter';

describe('cloud run rate limiter identity', () => {
  it('prefers forwarded end-user identity over shared API key', () => {
    const key = extractClientKeyFromHeaders((name) => {
      const headers: Record<string, string> = {
        [RATE_LIMIT_IDENTITY_HEADER]: 'guest:abc123',
        'X-API-Key': 'shared-service-secret',
        'X-Forwarded-For': '203.0.113.10',
      };

      return headers[name];
    });

    expect(key).toBe('fwd:guest:abc123');
  });
});
