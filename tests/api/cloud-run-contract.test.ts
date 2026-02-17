/**
 * Cloud Run API Contract Tests
 *
 * Cloud Run AI Engine의 계약(Contract) 테스트
 * - /health, /warmup: LLM 비호출 엔드포인트만 검증
 * - /monitoring: 인증 필요 엔드포인트 검증
 * - 인증 거부 테스트
 * - CLOUD_RUN_AI_URL 미설정 시 자동 skip
 * - Supervisor 절대 호출하지 않음 (무료 티어 보호)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as z from 'zod';

const CLOUD_RUN_URL = process.env.CLOUD_RUN_AI_URL;
const API_SECRET = process.env.CLOUD_RUN_API_SECRET;

const shouldRun = !!CLOUD_RUN_URL;

// ============================================================================
// Zod Schemas — Cloud Run API Contract 정의
// ============================================================================

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('ai-engine'),
  version: z.string(),
  config: z.record(z.unknown()),
  redis: z.boolean(),
  timestamp: z.string(),
});

const WarmupResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal('warmed_up'),
    keys: z.record(z.unknown()),
    precomputed: z.object({
      totalSlots: z.literal(144),
      currentSlot: z.number(),
      currentTime: z.string(),
      serverCount: z.number(),
      runtimeStateReady: z.boolean(),
      summary: z.unknown(),
    }),
  }),
});

const MonitoringResponseSchema = z.object({
  status: z.literal('ok'),
  circuits: z.record(z.unknown()),
  langfuse: z.unknown(),
  agents: z.unknown(),
  timestamp: z.string(),
});

const UnauthorizedResponseSchema = z.object({
  error: z.string(),
});

// ============================================================================
// Tests
// ============================================================================

describe.skipIf(!shouldRun)('Cloud Run API Contract Tests', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = CLOUD_RUN_URL!.replace(/\/$/, '');
  });

  // --------------------------------------------------------------------------
  // /health 엔드포인트
  // --------------------------------------------------------------------------
  describe('GET /health', () => {
    it('응답 스키마가 올바르다', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(() => HealthResponseSchema.parse(data)).not.toThrow();
    });

    it('status가 ok이다', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(data.status).toBe('ok');
      expect(data.service).toBe('ai-engine');
    });

    it('version이 semver 형식이다', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(data.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('timestamp가 ISO 8601 형식이다', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  // --------------------------------------------------------------------------
  // /warmup 엔드포인트
  // --------------------------------------------------------------------------
  describe('GET /warmup', () => {
    it('응답 스키마가 올바르다', async () => {
      const response = await fetch(`${baseUrl}/warmup`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(() => WarmupResponseSchema.parse(data)).not.toThrow();
    });

    it('precomputed에 144 슬롯 정보 포함', async () => {
      const response = await fetch(`${baseUrl}/warmup`);
      const data = await response.json();

      expect(data.data.precomputed.totalSlots).toBe(144);
      expect(data.data.precomputed.serverCount).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 인증 테스트 (/api/* 경로)
  // --------------------------------------------------------------------------
  describe('Authentication', () => {
    it('API Key 미제공 시 401 반환', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor/health`);

      expect(response.status).toBe(401);
    });

    it('잘못된 API Key 시 401 반환', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor/health`, {
        headers: { 'X-API-Key': 'invalid-key-12345' },
      });

      expect(response.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // /monitoring 엔드포인트 (인증 필요)
  // --------------------------------------------------------------------------
  describe.skipIf(!API_SECRET)('GET /monitoring (authenticated)', () => {
    it('올바른 인증 시 200 + 스키마 검증', async () => {
      const response = await fetch(`${baseUrl}/monitoring`, {
        headers: { 'X-API-Key': API_SECRET! },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(() => MonitoringResponseSchema.parse(data)).not.toThrow();
    });

    it('circuits 정보가 포함된다', async () => {
      const response = await fetch(`${baseUrl}/monitoring`, {
        headers: { 'X-API-Key': API_SECRET! },
      });
      const data = await response.json();

      expect(data.circuits).toBeDefined();
      expect(data.status).toBe('ok');
    });
  });

  describe('GET /monitoring (unauthenticated)', () => {
    it('인증 없이 403 반환', async () => {
      const response = await fetch(`${baseUrl}/monitoring`);

      expect(response.status).toBe(403);
    });
  });
});
