import type { SSEStreamingApi } from 'hono/streaming';
import { logger } from '../lib/logger';

type StreamWriter = Pick<SSEStreamingApi, 'writeSSE'>;

export interface SupervisorStreamErrorData {
  code: string;
  message: string;
  [key: string]: unknown;
}

export async function emitSupervisorStreamError(
  stream: StreamWriter,
  messageId: number,
  data: SupervisorStreamErrorData,
): Promise<boolean> {
  try {
    await stream.writeSSE({
      id: String(messageId),
      event: 'error',
      data: JSON.stringify({ type: 'error', data }),
    });
    return true;
  } catch {
    logger.warn({ code: data.code }, 'Failed to write error event to stream (connection lost)');
    return false;
  }
}
