/**
 * Stream State Management for Resumable Streams (v2)
 *
 * Redis-based state tracking for AI SDK v6 resumable stream pattern.
 * Maps sessionId to active streamId for stream resumption.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
 * @created 2026-01-24
 */

import { logger } from '@/lib/logging';
import { getRedisClient, isRedisEnabled } from '@/lib/redis/client';

const STREAM_KEY_PREFIX = 'ai:stream:v2:';
/** Active stream TTL: 10 minutes (supports complex analysis queries) */
const STREAM_TTL_SECONDS = 600;

function buildStreamStateKey(sessionId: string, ownerKey: string): string {
  return `${STREAM_KEY_PREFIX}${ownerKey}:${sessionId}`;
}

/**
 * Save active stream ID for a session
 * Used when creating a new resumable stream
 */
export async function saveActiveStreamId(
  sessionId: string,
  streamId: string,
  ownerKey: string
): Promise<void> {
  if (!isRedisEnabled()) {
    logger.debug('[StreamState] Redis disabled, skipping save');
    return;
  }

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(buildStreamStateKey(sessionId, ownerKey), streamId, {
      ex: STREAM_TTL_SECONDS,
    });
    logger.debug(
      `[StreamState] Saved streamId ${streamId} for session ${sessionId} (owner: ${ownerKey.slice(0, 20)})`
    );
  } catch (error) {
    logger.warn('[StreamState] Failed to save stream state:', error);
  }
}

/**
 * Get active stream ID for a session
 * Used when attempting to resume a stream
 */
export async function getActiveStreamId(
  sessionId: string,
  ownerKey: string
): Promise<string | null> {
  if (!isRedisEnabled()) {
    return null;
  }

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const streamId = await redis.get<string>(
      buildStreamStateKey(sessionId, ownerKey)
    );
    if (streamId) {
      logger.debug(
        `[StreamState] Found active streamId ${streamId} for session ${sessionId} (owner: ${ownerKey.slice(0, 20)})`
      );
    }
    return streamId;
  } catch (error) {
    logger.warn('[StreamState] Failed to get stream state:', error);
    return null;
  }
}

export async function clearActiveStreamId(
  sessionId: string,
  ownerKey: string
): Promise<void> {
  if (!isRedisEnabled()) return;

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(buildStreamStateKey(sessionId, ownerKey));
    logger.debug(
      `[StreamState] Cleared stream state for session ${sessionId} (owner: ${ownerKey.slice(0, 20)})`
    );
  } catch (error) {
    logger.warn('[StreamState] Failed to clear stream state:', error);
  }
}

/**
 * Check if a stream is still active
 */
export async function isStreamActive(
  sessionId: string,
  ownerKey: string
): Promise<boolean> {
  const streamId = await getActiveStreamId(sessionId, ownerKey);
  return streamId !== null;
}
