import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redisState = vi.hoisted(() => ({
  client: null as null | {
    eval: (
      script: string,
      keys: string[],
      args?: string[]
    ) => Promise<unknown[]>;
  },
}));

vi.mock('../lib/redis-client', () => ({
  getRedisClient: () => redisState.client,
}));
import {
  extractClientKeyFromHeaders,
  RATE_LIMIT_IDENTITY_HEADER,
  rateLimitMiddleware,
} from './rate-limiter';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  redisState.client = null;
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
    const body = await blocked.json();
    expect(body.retryAfter).toBeGreaterThanOrEqual(60);
    expect(body.retryAfter).toBeLessThanOrEqual(62);
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

  it('uses redis eval atomic script path when redis is available', async () => {
    const counters = new Map<string, number>();
    const resetAt = new Map<string, number>();
    const now = Date.now();

    const redisEval = vi.fn(
      async (_script: string, keys: string[], args?: string[]) => {
        const minuteKey = keys[0];
        const dailyKey = keys[1];
        const minuteLimit = Number(args?.[0] ?? 0);
        const minuteWindowMs = Number(args?.[1] ?? 60_000);
        const dailyLimit = Number(args?.[2] ?? 0);
        const dailyWindowMs = Number(args?.[3] ?? 86_400_000);

        const minuteCount = counters.get(minuteKey) ?? 0;
        const minuteExpiry = resetAt.get(minuteKey) ?? now + minuteWindowMs;
        const minuteTtl = Math.max(1, minuteExpiry - now);

        const dailyCount = counters.get(dailyKey) ?? 0;
        const dailyExpiry = resetAt.get(dailyKey) ?? now + dailyWindowMs;
        const dailyTtl = Math.max(1, dailyExpiry - now);

        if (minuteCount >= minuteLimit) {
          return [0, minuteCount, minuteTtl, dailyCount, dailyTtl, 1];
        }
        if (dailyLimit > 0 && dailyCount >= dailyLimit) {
          return [0, minuteCount, dailyTtl, dailyCount, dailyTtl, 2];
        }

        const nextMinuteCount = minuteCount + 1;
        counters.set(minuteKey, nextMinuteCount);
        if (!resetAt.has(minuteKey)) {
          resetAt.set(minuteKey, now + minuteWindowMs);
        }

        let nextDailyCount = dailyCount;
        if (dailyLimit > 0) {
          nextDailyCount += 1;
          counters.set(dailyKey, nextDailyCount);
          if (!resetAt.has(dailyKey)) {
            resetAt.set(dailyKey, now + dailyWindowMs);
          }
        }

        return [1, nextMinuteCount, minuteTtl, nextDailyCount, dailyTtl, 0];
      }
    );

    redisState.client = {
      eval: redisEval,
    };

    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);
    app.post('/api/jobs/process', (c) => c.json({ ok: true }));

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:redis-eval-atomic',
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
    expect(redisEval).toHaveBeenCalled();
  });

  it('sheds overload when jobs/process in-flight concurrency exceeds cap', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const app = new Hono();
    app.use('/api/*', rateLimitMiddleware);

    let releaseProcessing: (() => void) | null = null;
    const processingGate = new Promise<void>((resolve) => {
      releaseProcessing = resolve;
    });

    app.post('/api/jobs/process', async (c) => {
      await processingGate;
      return c.json({ ok: true });
    });

    const headers = {
      [RATE_LIMIT_IDENTITY_HEADER]: 'test:jobs-inflight-overload',
      'X-API-Key': 'shared-service-secret',
    };

    const first = app.request('/api/jobs/process', { method: 'POST', headers });
    const second = app.request('/api/jobs/process', { method: 'POST', headers });
    const third = app.request('/api/jobs/process', { method: 'POST', headers });

    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseProcessing?.();

    const [res1, res2, res3] = await Promise.all([first, second, third]);
    const statuses = [res1.status, res2.status, res3.status].sort((a, b) => a - b);

    expect(statuses).toEqual([200, 200, 429]);

    const overload = [res1, res2, res3].find((res) => res.status === 429);
    expect(overload).toBeDefined();
    expect(overload?.headers.get('X-RateLimit-Overload')).toBe('true');

    const body = await overload!.json();
    expect(body.limitScope).toBe('concurrency');
    expect(body.retryAfter).toBe(4);
    expect(overload?.headers.get('Retry-After')).toBe('4');
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
    expect(blocked.headers.get('Retry-After')).toBe('85800');

    const body = await blocked.json();
    expect(body.limitScope).toBe('daily');
    expect(body.dailyLimitExceeded).toBe(true);
    expect(body.retryAfter).toBe(85800);
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
