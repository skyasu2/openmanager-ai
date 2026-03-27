import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSiteUrl: vi.fn(() => 'https://openmanager-ai.vercel.app'),
}));
vi.mock('@/lib/site-url', () => ({ getSiteUrl: mocks.getSiteUrl }));

import { getCorsHeaders, handleOptionsRequest } from './cors';

describe('getCorsHeaders', () => {
  beforeEach(() => {
    mocks.getSiteUrl.mockReturnValue('https://openmanager-ai.vercel.app');
    vi.unstubAllEnvs();
  });

  it('returns all 4 CORS headers', () => {
    const headers = getCorsHeaders();

    expect(headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(headers).toHaveProperty('Access-Control-Allow-Methods');
    expect(headers).toHaveProperty('Access-Control-Allow-Headers');
    expect(headers).toHaveProperty('Access-Control-Allow-Credentials');
    expect(Object.keys(headers)).toHaveLength(4);
  });

  it('uses default site URL when no origin is provided', () => {
    const headers = getCorsHeaders();

    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://openmanager-ai.vercel.app'
    );
  });

  it('reflects localhost:3000 as Allow-Origin (dev origin)', () => {
    const headers = getCorsHeaders('http://localhost:3000');

    expect(headers['Access-Control-Allow-Origin']).toBe(
      'http://localhost:3000'
    );
  });

  it('reflects Vercel preview URL as Allow-Origin', () => {
    const previewUrl = 'https://openmanager-ai-abc123.vercel.app';
    const headers = getCorsHeaders(previewUrl);

    expect(headers['Access-Control-Allow-Origin']).toBe(previewUrl);
  });

  it('falls back to site URL for unknown origin', () => {
    const headers = getCorsHeaders('https://evil.example.com');

    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://openmanager-ai.vercel.app'
    );
  });

  it('reflects env-configured origin (NEXT_PUBLIC_APP_URL)', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://custom-app.example.com');

    const headers = getCorsHeaders('https://custom-app.example.com');

    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://custom-app.example.com'
    );
  });
});

describe('handleOptionsRequest', () => {
  beforeEach(() => {
    mocks.getSiteUrl.mockReturnValue('https://openmanager-ai.vercel.app');
    vi.unstubAllEnvs();
  });

  it('returns 200 status', () => {
    const response = handleOptionsRequest();

    expect(response.status).toBe(200);
  });

  it('sets CORS headers from request origin', () => {
    const request = new Request('https://openmanager-ai.vercel.app/api/test', {
      headers: { origin: 'http://localhost:3000' },
    });

    const response = handleOptionsRequest(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000'
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
  });

  it('uses default headers when no request is provided', () => {
    const response = handleOptionsRequest();

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://openmanager-ai.vercel.app'
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, PUT, DELETE, OPTIONS'
    );
  });
});
