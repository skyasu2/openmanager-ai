/**
 * Provider Routes Tests
 *
 * GET /providers, POST /providers/:name/toggle, POST /providers/reset 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/ai-sdk/model-provider', () => ({
  toggleProvider: vi.fn(),
  getProviderToggleState: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
  })),
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: false,
  })),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { providersRouter } from './providers';
import { toggleProvider, checkProviderStatus } from '../services/ai-sdk/model-provider';

const app = new Hono();
app.route('/providers', providersRouter);

describe('Provider Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /providers', () => {
    it('현재 프로바이더 상태를 반환한다', async () => {
      const res = await app.request('/providers');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.toggle).toEqual({ cerebras: true, groq: true, mistral: true });
      expect(json.available).toBeDefined();
      expect(json.info).toBeDefined();
    });
  });

  describe('POST /providers/:name/toggle', () => {
    it('유효한 프로바이더를 비활성화한다', async () => {
      const res = await app.request('/providers/cerebras/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.provider).toBe('cerebras');
      expect(json.enabled).toBe(false);
      expect(toggleProvider).toHaveBeenCalledWith('cerebras', false);
    });

    it('유효한 프로바이더를 활성화한다', async () => {
      const res = await app.request('/providers/groq/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(true);
    });

    it('잘못된 프로바이더 이름 시 400을 반환한다', async () => {
      const res = await app.request('/providers/invalid/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('enabled 필드 없으면 false로 처리한다', async () => {
      const res = await app.request('/providers/cerebras/toggle', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(false);
    });
  });

  describe('POST /providers/reset', () => {
    it('모든 프로바이더를 활성화로 리셋한다', async () => {
      const res = await app.request('/providers/reset', { method: 'POST' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('reset');
      expect(toggleProvider).toHaveBeenCalledTimes(3);
      expect(checkProviderStatus).toHaveBeenCalled();
    });
  });
});
