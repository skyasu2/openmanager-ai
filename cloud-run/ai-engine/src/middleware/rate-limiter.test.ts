import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/redis-client', () => ({
  getRedisClient: () => null,
}));
import {
  extractClientKeyFromHeaders,
  RATE_LIMIT_IDENTITY_HEADER,
  rateLimitMiddleware,
} from './rate-limiter';

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
  });
});

describe('cloud run daily semantics', () => {
  it('keeps supervisor write traffic on the strict 10/min minute bucket', async () => {
    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.post('/api/ai/supervisor/stream/v2', (c) => c.json({ ok: true }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:supervisor-minute-10',
      'X-API-Key': 'shared-service-secret',
    };

    for (let index = 0; index < 10; index += 1) {
      const res = await app.request('/api/ai/supervisor/stream/v2', {
        method: 'POST',
        headers,
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request('/api/ai/supervisor/stream/v2', {
      method: 'POST',
      headers,
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('blocks supervisor requests on the 101st request with daily metadata after minute windows reset', async () => {
    vi.useFakeTimers();

    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.post('/api/ai/supervisor/stream/v2', (c) => c.json({ ok: true }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:supervisor-daily-101',
      'X-API-Key': 'shared-service-secret',
    };

    for (let batch = 0; batch < 10; batch += 1) {
      for (let index = 0; index < 10; index += 1) {
        const res = await app.request('/api/ai/supervisor/stream/v2', {
          method: 'POST',
          headers,
        });
        expect(res.status).toBe(200);
      }

      vi.advanceTimersByTime(60_001);
    }

    const blocked = await app.request('/api/ai/supervisor/stream/v2', {
      method: 'POST',
      headers,
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Daily-Limit')).toBe('100');
    expect(blocked.headers.get('X-RateLimit-Daily-Remaining')).toBe('0');

    const body = await blocked.json();
    expect(body.limitScope).toBe('daily');
    expect(body.dailyLimitExceeded).toBe(true);
  });
});

describe('cloud run supervisor health limiter policy', () => {
  it('advertises a looser 120/min health bucket', async () => {
    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.get('/api/ai/supervisor/health', (c) => c.json({ ok: true }));

    const res = await app.request('/api/ai/supervisor/health', {
      method: 'GET',
      headers: {
        [RATE_LIMIT_IDENTITY_HEADER]: 'test:supervisor-health-window',
        'X-API-Key': 'shared-service-secret',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
  });

  it('does not let supervisor health checks consume the strict 10/min write bucket', async () => {
    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.get('/api/ai/supervisor/health', (c) => c.json({ ok: true }));
    app.post('/api/ai/supervisor/stream/v2', (c) => c.json({ ok: true }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:supervisor-health-split',
      'X-API-Key': 'shared-service-secret',
    };

    for (let index = 0; index < 15; index += 1) {
      const health = await app.request('/api/ai/supervisor/health', {
        method: 'GET',
        headers,
      });
      expect(health.status).toBe(200);
    }

    for (let index = 0; index < 10; index += 1) {
      const write = await app.request('/api/ai/supervisor/stream/v2', {
        method: 'POST',
        headers,
      });
      expect(write.status).toBe(200);
    }

    const blocked = await app.request('/api/ai/supervisor/stream/v2', {
      method: 'POST',
      headers,
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('10');
  });
});
