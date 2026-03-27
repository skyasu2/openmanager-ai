/**
 * Upstash-Compatible Resumable Stream
 *
 * Polling-based implementation for Upstash REST API (no Pub/Sub).
 * Uses Redis List to store stream chunks for resume capability.
 *
 * Architecture:
 * - POST: Store chunks as they arrive (RPUSH to list)
 * - GET: Read chunks from cursor position (LRANGE)
 * - TTL: Auto-expire after 10 minutes
 *
 * @see https://upstash.com/blog/resumable-llm-streams
 * @created 2026-01-24
 */

import { getRedisTimeoutMs } from '@/config/redis-timeouts';
import { logger } from '@/lib/logging';
import {
  getRedisClient,
  isRedisEnabled,
  runRedisWithTimeout,
} from '@/lib/redis/client';

const STREAM_PREFIX = 'ai:resumable:';
const STREAM_TTL_SECONDS = 600; // 10 minutes
const REDIS_TIMEOUT_MS = getRedisTimeoutMs('standard');

export interface StreamMetadata {
  status: 'active' | 'completed' | 'error';
  totalChunks: number;
  startedAt: number;
  completedAt?: number;
}

/**
 * Create a new resumable stream context
 */
export function createUpstashResumableContext() {
  const redis = isRedisEnabled() ? getRedisClient() : null;

  return {
    /**
     * Create a new resumable stream
     * Wraps an incoming ReadableStream and stores chunks in Redis
     */
    async createNewResumableStream(
      streamId: string,
      makeStream: () => ReadableStream<Uint8Array>
    ): Promise<ReadableStream<Uint8Array>> {
      const dataKey = `${STREAM_PREFIX}${streamId}:data`;
      const metaKey = `${STREAM_PREFIX}${streamId}:meta`;

      // Initialize metadata
      if (redis) {
        const metadata: StreamMetadata = {
          status: 'active',
          totalChunks: 0,
          startedAt: Date.now(),
        };
        await runRedisWithTimeout(
          `resumable SET ${metaKey}`,
          () =>
            redis.set(metaKey, JSON.stringify(metadata), {
              ex: STREAM_TTL_SECONDS,
            }),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );
      }

      const sourceStream = makeStream();
      const reader = sourceStream.getReader();
      // 🎯 CODEX Review Fix: stream: true 옵션으로 UTF-8 멀티바이트 경계 손상 방지
      const decoder = new TextDecoder();

      let chunkIndex = 0;
      const initialStartedAt = Date.now();

      // Create a transform stream that stores chunks in Redis
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();

            if (done) {
              // 🎯 CODEX Review R3 Fix: UTF-8 멀티바이트 버퍼 flush
              // TextDecoder의 stream:true 옵션 사용 시 버퍼에 남은 바이트를 flush해야 함
              if (redis) {
                const flush = decoder.decode(); // 빈 인자로 호출하면 버퍼 flush
                if (flush) {
                  await runRedisWithTimeout(
                    `resumable RPUSH ${dataKey}`,
                    () => redis.rpush(dataKey, flush),
                    { timeoutMs: REDIS_TIMEOUT_MS }
                  );
                  await runRedisWithTimeout(
                    `resumable EXPIRE ${dataKey}`,
                    () => redis.expire(dataKey, STREAM_TTL_SECONDS),
                    { timeoutMs: REDIS_TIMEOUT_MS }
                  );
                  chunkIndex++;
                }
                // 🎯 CODEX Review Fix: 원래 startedAt 유지
                const metadata: StreamMetadata = {
                  status: 'completed',
                  totalChunks: chunkIndex,
                  startedAt: initialStartedAt,
                  completedAt: Date.now(),
                };
                await runRedisWithTimeout(
                  `resumable SET ${metaKey}`,
                  () =>
                    redis.set(metaKey, JSON.stringify(metadata), {
                      ex: STREAM_TTL_SECONDS,
                    }),
                  { timeoutMs: REDIS_TIMEOUT_MS }
                );
              }
              controller.close();
              return;
            }

            // Store chunk in Redis list
            if (redis && value) {
              // 🎯 CODEX Review Fix: stream: true로 UTF-8 멀티바이트 경계 손상 방지
              const chunkStr = decoder.decode(value, { stream: true });
              await runRedisWithTimeout(
                `resumable RPUSH ${dataKey}`,
                () => redis.rpush(dataKey, chunkStr),
                { timeoutMs: REDIS_TIMEOUT_MS }
              );
              // Refresh TTL
              await runRedisWithTimeout(
                `resumable EXPIRE ${dataKey}`,
                () => redis.expire(dataKey, STREAM_TTL_SECONDS),
                { timeoutMs: REDIS_TIMEOUT_MS }
              );
              chunkIndex++;
            }

            controller.enqueue(value);
          } catch (error) {
            logger.error('[UpstashResumable] Stream error:', error);

            // Mark stream as error
            if (redis) {
              // 🎯 CODEX Review Fix: 원래 startedAt 유지
              const metadata: StreamMetadata = {
                status: 'error',
                totalChunks: chunkIndex,
                startedAt: initialStartedAt,
              };
              await runRedisWithTimeout(
                `resumable SET ${metaKey}`,
                () =>
                  redis.set(metaKey, JSON.stringify(metadata), {
                    ex: STREAM_TTL_SECONDS,
                  }),
                { timeoutMs: REDIS_TIMEOUT_MS }
              );
            }

            controller.error(error);
          }
        },
        cancel() {
          reader.cancel();
        },
      });
    },

    /**
     * Resume an existing stream from a given position
     * Returns null if stream doesn't exist or is already completed
     */
    async resumeExistingStream(
      streamId: string,
      skipChunks = 0
    ): Promise<ReadableStream<Uint8Array> | null> {
      if (!redis) {
        logger.debug('[UpstashResumable] Redis disabled, cannot resume');
        return null;
      }

      const dataKey = `${STREAM_PREFIX}${streamId}:data`;
      const metaKey = `${STREAM_PREFIX}${streamId}:meta`;

      // Check metadata
      const metaStr = await runRedisWithTimeout(
        `resumable GET ${metaKey}`,
        () => redis.get<string>(metaKey),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );
      if (!metaStr) {
        logger.debug(`[UpstashResumable] No stream found: ${streamId}`);
        return null;
      }

      let metadata: StreamMetadata;
      try {
        metadata = JSON.parse(metaStr);
      } catch {
        logger.warn(`[UpstashResumable] Invalid metadata JSON: ${streamId}`);
        return null;
      }

      // 🎯 CODEX Review Fix: error 상태만 거부, completed는 남은 chunk 재전송 허용
      if (metadata.status === 'error') {
        logger.warn(`[UpstashResumable] Stream had error: ${streamId}`);
        return null;
      }

      const isCompleted = metadata.status === 'completed';

      // Get all chunks from skip position
      const chunks = await runRedisWithTimeout(
        `resumable LRANGE ${dataKey}`,
        () => redis.lrange(dataKey, skipChunks, -1),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );
      const encoder = new TextEncoder();

      let currentIndex = 0;
      let cancelled = false;
      const pollInterval = 500; // Poll every 500ms for new chunks

      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (cancelled) {
            controller.close();
            return;
          }

          // First, emit buffered chunks
          if (currentIndex < chunks.length) {
            const chunk = chunks[currentIndex];
            if (typeof chunk === 'string') {
              controller.enqueue(encoder.encode(chunk));
            }
            currentIndex++;
            return;
          }

          // 🎯 CODEX Review Fix: completed 상태면 남은 chunk 모두 전송 후 종료
          if (isCompleted) {
            controller.close();
            return;
          }

          // Poll for new chunks (only for active streams)
          const newChunks = await runRedisWithTimeout(
            `resumable LRANGE ${dataKey}`,
            () => redis.lrange(dataKey, skipChunks + currentIndex, -1),
            { timeoutMs: REDIS_TIMEOUT_MS }
          );

          if (newChunks.length > 0) {
            const chunk = newChunks[0];
            if (typeof chunk === 'string') {
              controller.enqueue(encoder.encode(chunk));
            }
            currentIndex++;
            return;
          }

          // Check if stream is still active
          const latestMeta = await runRedisWithTimeout(
            `resumable GET ${metaKey}`,
            () => redis.get<string>(metaKey),
            { timeoutMs: REDIS_TIMEOUT_MS }
          );
          if (latestMeta) {
            try {
              const latest: StreamMetadata = JSON.parse(latestMeta);
              if (latest.status === 'completed' || latest.status === 'error') {
                controller.close();
                return;
              }
            } catch {
              // metadata 파싱 실패 시 stream 종료
              controller.close();
              return;
            }
          }

          // Wait and poll again
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        },
        cancel() {
          cancelled = true;
        },
      });
    },

    /**
     * Check if a stream exists and its status
     */
    async hasExistingStream(
      streamId: string
    ): Promise<null | 'active' | 'completed'> {
      if (!redis) return null;

      const metaKey = `${STREAM_PREFIX}${streamId}:meta`;
      const metaStr = await runRedisWithTimeout(
        `resumable GET ${metaKey}`,
        () => redis.get<string>(metaKey),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );

      if (!metaStr) return null;

      try {
        const metadata: StreamMetadata = JSON.parse(metaStr);
        return metadata.status === 'completed' ? 'completed' : 'active';
      } catch {
        return null;
      }
    },

    /**
     * Clear stream data
     */
    async clearStream(streamId: string): Promise<void> {
      if (!redis) return;

      const dataKey = `${STREAM_PREFIX}${streamId}:data`;
      const metaKey = `${STREAM_PREFIX}${streamId}:meta`;

      await Promise.all([
        runRedisWithTimeout(
          `resumable DEL ${dataKey}`,
          () => redis.del(dataKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        ),
        runRedisWithTimeout(
          `resumable DEL ${metaKey}`,
          () => redis.del(metaKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        ),
      ]);
    },
  };
}

export type UpstashResumableContext = ReturnType<
  typeof createUpstashResumableContext
>;
