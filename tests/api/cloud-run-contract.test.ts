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
import { beforeAll, describe, expect, it } from 'vitest';
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
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(() => UnauthorizedResponseSchema.parse(data)).not.toThrow();
    });

    it('잘못된 API Key 시 401 반환', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor/health`, {
        headers: { 'X-API-Key': 'invalid-key-12345' },
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(() => UnauthorizedResponseSchema.parse(data)).not.toThrow();
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
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(() => UnauthorizedResponseSchema.parse(data)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/ai/supervisor — 입력 검증 (LLM 0회)
  // --------------------------------------------------------------------------
  describe.skipIf(!API_SECRET)(
    'POST /api/ai/supervisor (input validation)',
    () => {
      it('빈 messages 배열 → 400 (Zod min(1) 가드)', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({ messages: [] }),
        });

        expect(response.status).toBe(400);
      });

      it('messages 누락 → 400', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(400);
      });

      it('빈 content → 400 (Zod min(1) 가드)', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '' }],
          }),
        });

        expect(response.status).toBe(400);
      });
    }
  );

  describe('POST /api/ai/supervisor (unauthenticated)', () => {
    it('인증 없이 401 반환', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/ai/supervisor/stream/v2 — 입력 검증 (LLM 0회)
  // --------------------------------------------------------------------------
  describe.skipIf(!API_SECRET)(
    'POST /api/ai/supervisor/stream/v2 (input validation)',
    () => {
      it('빈 messages 배열 → 400', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor/stream/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({ messages: [] }),
        });

        expect(response.status).toBe(400);
      });

      it('빈 content → 400', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor/stream/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '' }],
          }),
        });

        expect(response.status).toBe(400);
      });
    }
  );

  describe('POST /api/ai/supervisor/stream/v2 (unauthenticated)', () => {
    it('인증 없이 401 반환', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor/stream/v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // HTTP 메서드 검증
  // --------------------------------------------------------------------------
  describe('HTTP Method Validation', () => {
    it('GET /api/ai/supervisor → 404 또는 405 (POST only)', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
        headers: API_SECRET ? { 'X-API-Key': API_SECRET } : {},
      });

      expect([404, 405]).toContain(response.status);
    });

    it('PUT /api/ai/supervisor → 404 또는 405', async () => {
      const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(API_SECRET && { 'X-API-Key': API_SECRET }),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      expect([404, 405]).toContain(response.status);
    });
  });

  // --------------------------------------------------------------------------
  // 응답 헤더 검증
  // --------------------------------------------------------------------------
  describe('Response Headers', () => {
    it('/health 응답에 Content-Type: application/json 포함', async () => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.headers.get('content-type')).toContain(
        'application/json'
      );
    });

    it('/health 응답 시간이 5초 미만', async () => {
      const start = Date.now();
      await fetch(`${baseUrl}/health`);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });
  });

  // --------------------------------------------------------------------------
  // GET /ready — Readiness Check
  // --------------------------------------------------------------------------
  describe('GET /ready', () => {
    it('200 또는 503으로 응답', async () => {
      const response = await fetch(`${baseUrl}/ready`);

      // 라우트 로딩 상태에 따라 200(ready) 또는 503(starting)
      expect([200, 503]).toContain(response.status);
    });

    it('응답에 status 필드 포함', async () => {
      const response = await fetch(`${baseUrl}/ready`);
      const data = await response.json();

      expect(['ready', 'starting']).toContain(data.status);
      expect(data.timestamp).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/ai/supervisor — 보안 입력 검증 (LLM 0회)
  // --------------------------------------------------------------------------
  describe.skipIf(!API_SECRET)(
    'POST /api/ai/supervisor (security validation)',
    () => {
      it('과도하게 긴 content → 400 또는 처리됨', async () => {
        const longContent = 'a'.repeat(50_000);
        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: longContent }],
          }),
        });

        // 400(입력 제한) 또는 200(처리됨) 어느 쪽이든 서버가 크래시하지 않으면 OK
        expect([200, 400, 413]).toContain(response.status);
      });

      it('잘못된 role 값 → 400', async () => {
        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({
            messages: [{ role: 'invalid_role', content: 'test' }],
          }),
        });

        expect(response.status).toBe(400);
      });

      it('50개 초과 messages → 400', async () => {
        const messages = Array.from({ length: 51 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `message ${i}`,
        }));

        const response = await fetch(`${baseUrl}/api/ai/supervisor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_SECRET!,
          },
          body: JSON.stringify({ messages }),
        });

        expect(response.status).toBe(400);
      });
    }
  );
});
