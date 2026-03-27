import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from './route';

describe('POST /api/security/csp-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효한 JSON 리포트 수신 시 204를 반환한다', async () => {
    const payload = JSON.stringify({
      'document-uri': 'https://example.test',
      'violated-directive': 'script-src',
      'blocked-uri': 'https://tracker.example.com',
    });

    const request = new NextRequest(
      'http://localhost/api/security/csp-report',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: payload,
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  it('JSON 파싱 실패 시 400을 반환한다', async () => {
    const request = new NextRequest(
      'http://localhost/api/security/csp-report',
      {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
        },
        body: 'not json',
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Error');
  });
});
