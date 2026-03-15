import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage } from 'ai';

vi.mock('../../lib/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/redis-client', () => ({
  RedisClient: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { RedisClient } from '../../lib/redis-client';
import { SessionMemoryService } from './session-memory';

describe('SessionMemoryService.getHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stored history when Redis responds in time', async () => {
    const history: ModelMessage[] = [{ role: 'user', content: 'hello' }];
    vi.mocked(RedisClient.get).mockResolvedValueOnce(history);

    await expect(SessionMemoryService.getHistory('session-1')).resolves.toEqual(
      history
    );
    expect(RedisClient.get).toHaveBeenCalledWith('chat:history:session-1', {
      timeoutMs: 1_500,
    });
  });

  it('returns empty history when Redis lookup times out or returns null', async () => {
    vi.mocked(RedisClient.get).mockResolvedValueOnce(null);

    await expect(SessionMemoryService.getHistory('session-timeout')).resolves.toEqual([]);
    expect(RedisClient.get).toHaveBeenCalledWith(
      'chat:history:session-timeout',
      { timeoutMs: 1_500 }
    );
  });
});
