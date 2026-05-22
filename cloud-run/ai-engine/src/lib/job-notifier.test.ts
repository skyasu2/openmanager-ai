import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedisGet, mockRedisSet, mockRedisDel } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}));

vi.mock('./redis-client', () => ({
  getRedisClient: vi.fn(() => ({})),
  redisGet: mockRedisGet,
  redisSet: mockRedisSet,
  redisDel: mockRedisDel,
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { storeJobResult } from './job-notifier';

describe('job-notifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue(true);
  });

  it('preserves existing job metadata when storing completed results', async () => {
    mockRedisGet.mockResolvedValueOnce({
      id: 'job-1',
      status: 'processing',
      startedAt: '2026-04-28T00:00:00.000Z',
      metadata: {
        ownerKey: 'owner-123',
        complexity: 'complex',
        estimatedTime: 60,
        factors: { multiStep: true },
      },
    });

    await expect(
      storeJobResult('job-1', 'done', {
        metadata: {
          traceId: 'trace-1',
          handoffs: [{ from: 'supervisor', to: 'analyst' }],
        },
      })
    ).resolves.toBe(true);

    expect(mockRedisSet).toHaveBeenCalledWith(
      'job:job-1',
      expect.objectContaining({
        status: 'completed',
        result: 'done',
        metadata: expect.objectContaining({
          ownerKey: 'owner-123',
          complexity: 'complex',
          estimatedTime: 60,
          factors: { multiStep: true },
          traceId: 'trace-1',
          handoffs: [{ from: 'supervisor', to: 'analyst' }],
        }),
      }),
      3600
    );
  });
});
