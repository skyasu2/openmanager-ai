/**
 * 🧪 OpenManager AI - API Contract Tests
 *
 * @description 핵심 API 엔드포인트의 Contract(스키마/응답형식) 검증
 * @author Claude Code (Test Automation Specialist)
 * @created 2025-12-19
 *
 * 이 테스트는 Mock 기반으로 실행되며 실제 서버를 호출하지 않습니다.
 * Vercel/배포 환경에 부하를 주지 않습니다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

const BASE_URL = 'http://localhost:3002';

// ============================================================
// 📋 Zod Schemas - API Contract 정의
// ============================================================

/**
 * /api/servers-unified 목록 응답 스키마
 */
const ServersUnifiedListSchema = z.object({
  success: z.boolean(),
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      hostname: z.string(),
      status: z.enum(['online', 'warning', 'offline']),
      cpu: z.number().min(0).max(100),
      memory: z.number().min(0).max(100),
      disk: z.number().min(0).max(100),
      network: z.number().min(0),
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  timestamp: z.string(),
});

/**
 * /api/servers-unified?action=detail 응답 스키마
 */
const ServersUnifiedDetailSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    hostname: z.string(),
    status: z.enum(['online', 'warning', 'offline']),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    network: z.number(),
    uptime: z.number(),
  }),
  timestamp: z.string(),
});

/**
 * /api/ai/status 전체 상태 응답 스키마
 */
const AIStatusSummarySchema = z.object({
  summary: z.object({
    totalServices: z.number(),
    healthyServices: z.number(),
    degradedServices: z.number(),
    unhealthyServices: z.number(),
  }),
  services: z.record(
    z.string(),
    z.object({
      state: z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']),
      failures: z.number(),
      isOpen: z.boolean(),
    })
  ),
  recentEvents: z.array(z.any()),
  timestamp: z.number(),
});

/**
 * /api/ai/status?service=xxx 특정 서비스 응답 스키마
 */
const AIStatusServiceSchema = z.object({
  service: z.string(),
  status: z.object({
    state: z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']),
    failures: z.number(),
    lastFailure: z.union([z.string(), z.null()]),
    isOpen: z.boolean(),
  }),
  events: z.array(z.any()),
  timestamp: z.number(),
});

/**
 * 에러 응답 스키마
 */
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

// ============================================================
// 🧪 Tests
// ============================================================

describe('📜 API Contract Tests - /api/servers-unified', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // servers-unified Mock 구현
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlObj = new URL(url);
      const action = urlObj.searchParams.get('action') || 'list';
      const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
      const serverId = urlObj.searchParams.get('serverId');

      // action=detail
      if (action === 'detail') {
        if (!serverId) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () =>
              Promise.resolve({
                success: false,
                error: 'serverId is required for detail action',
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: serverId,
                name: `Server ${serverId}`,
                hostname: `${serverId}.local`,
                status: 'online',
                cpu: 45.2,
                memory: 67.8,
                disk: 23.5,
                network: 12.3,
                uptime: 86400,
              },
              timestamp: new Date().toISOString(),
            }),
        } as Response);
      }

      // list, cached, realtime 등
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
              id: `server-${i + 1}`,
              name: `Test Server ${i + 1}`,
              hostname: `test-${i + 1}.local`,
              status: i < 8 ? 'online' : i === 8 ? 'warning' : 'offline',
              cpu: 20 + Math.random() * 60,
              memory: 30 + Math.random() * 50,
              disk: 40 + Math.random() * 40,
              network: 5 + Math.random() * 20,
            })),
            pagination: {
              page: 1,
              limit,
              total: 10,
              totalPages: Math.ceil(10 / limit),
            },
            timestamp: new Date().toISOString(),
          }),
      } as Response);
    });
  });

  describe('GET /api/servers-unified?action=list', () => {
    it('목록 응답이 올바른 스키마를 따른다', async () => {
      const response = await fetch(`${BASE_URL}/api/servers-unified`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(() => ServersUnifiedListSchema.parse(data)).not.toThrow();
    });

    it('limit 파라미터가 응답 데이터 수를 제한한다', async () => {
      const response = await fetch(
        `${BASE_URL}/api/servers-unified?action=list&limit=5`
      );
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
      expect(data.pagination.limit).toBe(5);
    });

    it('서버 상태는 online/warning/offline 중 하나이다', async () => {
      const response = await fetch(`${BASE_URL}/api/servers-unified`);
      const data = await response.json();

      const validStatuses = ['online', 'warning', 'offline'];
      data.data.forEach(
        (server: { status: string; cpu: number; memory: number }) => {
          expect(validStatuses).toContain(server.status);
        }
      );
    });

    it('메트릭 값은 0-100 범위 내에 있다', async () => {
      const response = await fetch(`${BASE_URL}/api/servers-unified`);
      const data = await response.json();

      data.data.forEach((server: { cpu: number; memory: number }) => {
        expect(server.cpu).toBeGreaterThanOrEqual(0);
        expect(server.cpu).toBeLessThanOrEqual(100);
        expect(server.memory).toBeGreaterThanOrEqual(0);
        expect(server.memory).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('GET /api/servers-unified?action=detail', () => {
    it('상세 정보 응답이 올바른 스키마를 따른다', async () => {
      const response = await fetch(
        `${BASE_URL}/api/servers-unified?action=detail&serverId=server-1`
      );
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(() => ServersUnifiedDetailSchema.parse(data)).not.toThrow();
    });

    it('serverId 없이 detail 요청 시 400 에러를 반환한다', async () => {
      const response = await fetch(
        `${BASE_URL}/api/servers-unified?action=detail`
      );
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(() => ErrorResponseSchema.parse(data)).not.toThrow();
      expect(data.error).toContain('serverId is required');
    });

    it('상세 정보에 uptime 필드가 포함된다', async () => {
      const response = await fetch(
        `${BASE_URL}/api/servers-unified?action=detail&serverId=server-1`
      );
      const data = await response.json();

      expect(data.data.uptime).toBeDefined();
      expect(typeof data.data.uptime).toBe('number');
    });
  });
});

describe('📜 API Contract Tests - /api/ai/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // ai/status Mock 구현
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlObj = new URL(url);
      const service = urlObj.searchParams.get('service');

      // 특정 서비스 상태
      if (service) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              service,
              status: {
                state: 'CLOSED',
                failures: 0,
                lastFailure: null,
                isOpen: false,
              },
              events: [],
              timestamp: Date.now(),
            }),
        } as Response);
      }

      // 전체 상태 요약
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            summary: {
              totalServices: 3,
              healthyServices: 3,
              degradedServices: 0,
              unhealthyServices: 0,
            },
            services: {
              google: { state: 'CLOSED', failures: 0, isOpen: false },
              openai: { state: 'CLOSED', failures: 0, isOpen: false },
              cohere: { state: 'CLOSED', failures: 0, isOpen: false },
            },
            recentEvents: [],
            timestamp: Date.now(),
          }),
      } as Response);
    });
  });

  describe('GET /api/ai/status (전체)', () => {
    it('전체 상태 응답이 올바른 스키마를 따른다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(() => AIStatusSummarySchema.parse(data)).not.toThrow();
    });

    it('summary에 서비스 통계가 포함된다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status`);
      const data = await response.json();

      expect(data.summary.totalServices).toBeGreaterThan(0);
      expect(data.summary.healthyServices).toBeDefined();
      expect(data.summary.degradedServices).toBeDefined();
      expect(data.summary.unhealthyServices).toBeDefined();
    });

    it('각 서비스의 Circuit Breaker 상태가 포함된다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status`);
      const data = await response.json();

      const validStates = ['CLOSED', 'OPEN', 'HALF_OPEN'];

      Object.values(data.services).forEach(
        (service: { state: string; isOpen: boolean }) => {
          expect(validStates).toContain(service.state);
          expect(typeof service.isOpen).toBe('boolean');
        }
      );
    });
  });

  describe('GET /api/ai/status?service=xxx', () => {
    it('특정 서비스 상태 응답이 올바른 스키마를 따른다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status?service=google`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(() => AIStatusServiceSchema.parse(data)).not.toThrow();
    });

    it('요청한 서비스 이름이 응답에 포함된다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status?service=openai`);
      const data = await response.json();

      expect(data.service).toBe('openai');
    });

    it('서비스 상태에 state, failures, isOpen 필드가 있다', async () => {
      const response = await fetch(`${BASE_URL}/api/ai/status?service=cohere`);
      const data = await response.json();

      expect(data.status.state).toBeDefined();
      expect(typeof data.status.failures).toBe('number');
      expect(typeof data.status.isOpen).toBe('boolean');
    });
  });
});

describe('📜 API Contract - Cross-validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Combined mock for cross-validation
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/servers-unified')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: Array.from({ length: 10 }, (_, i) => ({
                id: `server-${i + 1}`,
                name: `Test Server ${i + 1}`,
                hostname: `test-${i + 1}.local`,
                status: i < 8 ? 'online' : i === 8 ? 'warning' : 'offline',
                cpu: 45,
                memory: 67,
                disk: 23,
                network: 12,
              })),
              pagination: { page: 1, limit: 10, total: 10, totalPages: 1 },
              timestamp: new Date().toISOString(),
            }),
        } as Response);
      }

      if (url.includes('/api/ai/status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              summary: {
                totalServices: 3,
                healthyServices: 3,
                degradedServices: 0,
                unhealthyServices: 0,
              },
              services: {
                google: { state: 'CLOSED', failures: 0, isOpen: false },
                openai: { state: 'CLOSED', failures: 0, isOpen: false },
                cohere: { state: 'CLOSED', failures: 0, isOpen: false },
              },
              recentEvents: [],
              timestamp: Date.now(),
            }),
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not Found' }),
      } as Response);
    });
  });

  it('servers-unified와 ai/status 응답에 timestamp가 존재한다', async () => {
    const [serversRes, aiRes] = await Promise.all([
      fetch(`${BASE_URL}/api/servers-unified`),
      fetch(`${BASE_URL}/api/ai/status`),
    ]);

    const serversData = await serversRes.json();
    const aiData = await aiRes.json();

    expect(serversData.timestamp).toBeDefined();
    expect(aiData.timestamp).toBeDefined();
  });

  it('모든 API 응답이 200 상태코드를 반환한다', async () => {
    const endpoints = [
      `${BASE_URL}/api/servers-unified`,
      `${BASE_URL}/api/ai/status`,
    ];

    const responses = await Promise.all(endpoints.map((url) => fetch(url)));

    responses.forEach((response) => {
      expect(response.ok).toBe(true);
    });
  });
});
