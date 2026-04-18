import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/redis-client', () => ({
  getRedisClient: () => null,
}));
import {
  extractClientKeyFromHeaders,
  RATE_LIMIT_IDENTITY_HEADER,
  rateLimitMiddleware,
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

describe('cloud run jobs limiter policy', () => {
  it('keeps POST /api/jobs/process on the strict 5/min write bucket', async () => {
    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.post('/api/jobs/process', (c) => c.json({ ok: true }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:jobs-write-strict',
      'X-API-Key': 'shared-service-secret',
    };

    for (let index = 0; index < 5; index += 1) {
      const res = await app.request('/api/jobs/process', {
        method: 'POST',
        headers,
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request('/api/jobs/process', {
      method: 'POST',
      headers,
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('5');
  });

  it('splits GET /api/jobs/:id/progress into a separate polling bucket', async () => {
    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.get('/api/jobs/:id/progress', (c) => c.json({ ok: true, id: c.req.param('id') }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:jobs-read-split',
      'X-API-Key': 'shared-service-secret',
    };

    for (let index = 0; index < 6; index += 1) {
      const res = await app.request('/api/jobs/job-123/progress', {
        method: 'GET',
        headers,
      });
      expect(res.status).toBe(200);
    }

    const res = await app.request('/api/jobs/job-123/progress', {
      method: 'GET',
      headers,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
  });
});
