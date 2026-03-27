import { describe, expect, it } from 'vitest';
import {
  buildApiNotReadyResponse,
  shouldBlockApiRequest,
} from './server-readiness';

describe('server-readiness', () => {
  it('routes가 준비되지 않았을 때 /api/* 요청을 차단한다', () => {
    expect(shouldBlockApiRequest('/api/ai/supervisor', false)).toBe(true);
    expect(shouldBlockApiRequest('/api/jobs', false)).toBe(true);
  });

  it('/health 같은 비 API 경로는 차단하지 않는다', () => {
    expect(shouldBlockApiRequest('/health', false)).toBe(false);
    expect(shouldBlockApiRequest('/ready', false)).toBe(false);
  });

  it('routes가 준비되면 /api/* 요청을 차단하지 않는다', () => {
    expect(shouldBlockApiRequest('/api/ai/supervisor', true)).toBe(false);
  });

  it('503 응답은 재시도 헤더와 타임스탬프를 포함한다', () => {
    const fixed = new Date('2026-03-03T00:00:00.000Z');
    const response = buildApiNotReadyResponse(fixed);

    expect(response.status).toBe(503);
    expect(response.headers['Retry-After']).toBe('2');
    expect(response.body.retryAfterSeconds).toBe(2);
    expect(response.body.timestamp).toBe('2026-03-03T00:00:00.000Z');
  });
});
