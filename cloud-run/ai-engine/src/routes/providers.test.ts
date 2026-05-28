/**
 * Provider Routes Tests
 *
 * GET /providers, POST /providers/:name/toggle, POST /providers/reset 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/config-parser', () => ({
  CEREBRAS_QWEN_MODEL_ID: 'qwen-3-235b-a22b-instruct-2507',
  CEREBRAS_QWEN_DEPRECATION_DATE: '2026-05-27',
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID: 'llama3.1-8b',
  CEREBRAS_GPT_OSS_MODEL_ID: 'gpt-oss-120b',
  DEFAULT_CEREBRAS_MODEL: 'gpt-oss-120b',
  DEPRECATED_CEREBRAS_QWEN_MODEL_ID: 'qwen-3-235b-a22b-instruct-2507',
  getCerebrasModelId: vi.fn(() => 'gpt-oss-120b'),
  getCerebrasFallbackModelIds: vi.fn((): string[] => []),
  getGroqModelId: vi.fn(() => 'meta-llama/llama-4-scout-17b-16e-instruct'),
  getMistralModelId: vi.fn(() => 'mistral-small-latest'),
  getZaiModelId: vi.fn(() => 'glm-4.5-flash'),
  isCerebrasToolCallingEnabled: vi.fn(() => false),
}));

vi.mock('../services/ai-sdk/model-provider', () => ({
  toggleProvider: vi.fn(),
  getProviderToggleState: vi.fn(() => ({
    cerebras: true,
    groq: true,
    zai: true,
    mistral: true,
    gemini: true,
  })),
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    zai: true,
    mistral: false,
    gemini: true,
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
      expect(json.toggle).toEqual({
        cerebras: true,
        groq: true,
        zai: true,
        mistral: true,
        gemini: true,
      });
      expect(json.available).toBeDefined();
      expect(json.info).toBeDefined();
      expect(json.modelDrift).toEqual([]);
      expect(json.modelMetadata).toHaveLength(5);
      expect(json.info.cerebras.model).toBe('gpt-oss-120b');
      expect(json.info.cerebras.toolCallingEnabled).toBe(false);
      expect(json.info.groq.model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
      expect(json.info.cerebras.role).toContain('gpt-oss-120b');
      expect(json.info.groq.role).toContain('Groq-first');
      expect(json.info.groq.role).not.toContain('Advisor');
      expect(json.info.zai.model).toBe('glm-4.5-flash');
      expect(json.info.zai.visionModel).toBeUndefined();
      expect(json.info.mistral.role).toBe('Distributed text fallback');
      expect(json.info.mistral.model).toBe('mistral-small-latest');
      expect(json.info.mistral.role).not.toContain('RAG');
      expect(json.info.gemini.role).toBe('Vision primary');
      expect(json.info.gemini.model).toBe('gemini-2.5-flash-lite');
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

    it('Gemini vision provider를 비활성화한다', async () => {
      const res = await app.request('/providers/gemini/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.provider).toBe('gemini');
      expect(json.enabled).toBe(false);
      expect(toggleProvider).toHaveBeenCalledWith('gemini', false);
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
      expect(toggleProvider).toHaveBeenCalledTimes(5);
      expect(toggleProvider).toHaveBeenCalledWith('gemini', true);
      expect(checkProviderStatus).toHaveBeenCalled();
    });
  });
});
