import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

function createRequest(body: unknown) {
  return new NextRequest('https://openmanager-ai.vercel.app/api/web-vitals', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('/api/web-vitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid landing payload and returns analysis', async () => {
    const response = await POST(
      createRequest({
        url: '/',
        hostname: 'openmanager-ai.vercel.app',
        appVersion: '8.10.8',
        timestamp: Date.now(),
        sessionId: 'session-1',
        deviceType: 'desktop',
        metrics: [
          {
            name: 'LCP',
            value: 1800,
            rating: 'good',
            delta: 1800,
            id: 'lcp-1',
          },
          {
            name: 'INP',
            value: 60,
            rating: 'good',
            delta: 60,
            id: 'inp-1',
          },
          {
            name: 'CLS',
            value: 0.04,
            rating: 'good',
            delta: 0.04,
            id: 'cls-1',
          },
        ],
      })
    );

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.analysis.overall).toBe('good');
    expect(json.data.analysis.score).toBeGreaterThan(80);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('returns recommendations when metrics are slow or unstable', async () => {
    const response = await POST(
      createRequest({
        url: '/',
        hostname: 'openmanager-ai.vercel.app',
        appVersion: '8.10.8',
        timestamp: Date.now(),
        sessionId: 'session-2',
        deviceType: 'mobile',
        metrics: [
          {
            name: 'LCP',
            value: 3600,
            rating: 'poor',
            delta: 3600,
            id: 'lcp-poor',
          },
          {
            name: 'CLS',
            value: 0.18,
            rating: 'poor',
            delta: 0.18,
            id: 'cls-poor',
          },
          {
            name: 'INP',
            value: 280,
            rating: 'poor',
            delta: 280,
            id: 'inp-poor',
          },
        ],
      })
    );

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.analysis.overall).toBe('poor');
    expect(json.data.analysis.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('이미지 최적화'),
        expect.stringContaining('레이아웃 시프트'),
        expect.stringContaining('JavaScript 실행 시간 최적화'),
      ])
    );
  });

  it('rejects invalid payloads', async () => {
    const response = await POST(
      createRequest({
        url: '/',
        hostname: 'openmanager-ai.vercel.app',
        appVersion: '8.10.8',
        timestamp: Date.now(),
        sessionId: 'session-3',
        deviceType: 'desktop',
        metrics: [],
      })
    );

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid web vitals payload');
  });
});
