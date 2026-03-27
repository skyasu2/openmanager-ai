import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { logger } from '../lib/logger';
import { emitSupervisorStreamError } from './supervisor-stream-error';

describe('emitSupervisorStreamError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a sanitized SSE error event', async () => {
    const stream = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    const written = await emitSupervisorStreamError(stream, 3, {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });

    expect(written).toBe(true);
    expect(stream.writeSSE).toHaveBeenCalledWith({
      id: '3',
      event: 'error',
      data: JSON.stringify({
        type: 'error',
        data: {
          code: 'INTERNAL_ERROR',
          message: 'Internal Server Error',
        },
      }),
    });
  });

  it('swallows disconnected-client write failures', async () => {
    const stream = {
      writeSSE: vi.fn().mockRejectedValue(new Error('socket closed')),
    };

    const written = await emitSupervisorStreamError(stream, 4, {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });

    expect(written).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      { code: 'INTERNAL_ERROR' },
      'Failed to write error event to stream (connection lost)'
    );
  });
});
