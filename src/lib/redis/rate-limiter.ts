/**
 * Upstash Rate Limiter
 *
 * 무료 티어 보호 & 고성능 Rate Limiting
 * - @upstash/ratelimit 기반 slidingWindow 알고리즘
 * - ephemeralCache로 DoS 방어 (Redis 호출 최소화)
 * - 분당 + 일일 통합 제한
 *
 * @module redis/rate-limiter
 */

import { Ratelimit } from '@upstash/ratelimit';
import type { NextRequest } from 'next/server';
import { getRedisTimeoutMs } from '@/config/redis-timeouts';
import { logger } from '@/lib/logging';
import {
  getRedisClient,
  isRedisDisabled,
  isRedisEnabled,
  runRedisWithTimeout,
} from './client';

// ==============================================
// 🎯 타입 정의
// ==============================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  /** 일일 제한 정보 (설정된 경우) */
  daily?: {
    remaining: number;
    resetTime: number;
  };
  /** Redis 사용 여부 */
  source: 'redis' | 'fallback';
  /** 응답 시간 (ms) */
  latencyMs?: number;
}

export interface RateLimitConfig {
  /** 분당 최대 요청 수 */
  maxRequests: number;
  /** 윈도우 시간 (ms) */
  windowMs: number;
  /** 일일 최대 요청 수 (선택) */
  dailyLimit?: number;
  /** 식별자 prefix */
  prefix?: string;
}

// ==============================================
// 🏗️ Rate Limiter 인스턴스 캐시
// ==============================================

// 분당 제한 인스턴스 캐시
const minuteLimiters = new Map<string, Ratelimit>();
// 일일 제한 인스턴스 캐시
const dailyLimiters = new Map<string, Ratelimit>();
const REDIS_TIMEOUT_MS = getRedisTimeoutMs('standard');

/**
 * Rate Limiter 인스턴스 생성 또는 캐시에서 반환
 */
function getOrCreateLimiter(
  key: string,
  maxRequests: number,
  windowMs: number,
  isDaily = false
): Ratelimit | null {
  const cache = isDaily ? dailyLimiters : minuteLimiters;

  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  // slidingWindow 알고리즘 사용 (가장 정확한 rate limiting)
  const windowSeconds = Math.ceil(windowMs / 1000);

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    // ephemeralCache: 메모리 캐시로 Redis 호출 최소화 (DoS 방어)
    ephemeralCache: new Map(),
    prefix: isDaily ? 'rl:daily' : 'rl:min',
    analytics: false, // 무료 티어 절약
  });

  cache.set(key, limiter);
  return limiter;
}

/**
 * 클라이언트 IP 추출
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown';
}

// ==============================================
// 🎯 Redis Rate Limit 체크
// ==============================================

/**
 * Redis 기반 Rate Limit 체크
 *
 * @param request NextRequest 객체
 * @param config Rate Limit 설정
 * @returns Rate Limit 결과
 */
export async function checkRedisRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  // Redis 비활성화 시 null 반환 (폴백 사용)
  if (isRedisDisabled() || !isRedisEnabled()) {
    return null;
  }

  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;
  const identifier = `${ip}:${config.prefix ?? path}`;

  const startTime = performance.now();

  try {
    // 분당 제한 체크
    const minuteLimiter = getOrCreateLimiter(
      `minute:${config.prefix ?? path}`,
      config.maxRequests,
      config.windowMs
    );

    if (!minuteLimiter) {
      return null;
    }

    const minuteResult = await runRedisWithTimeout(
      `rate-limit minute ${identifier}`,
      () => minuteLimiter.limit(identifier),
      { timeoutMs: REDIS_TIMEOUT_MS }
    );
    const latencyMs = Math.round(performance.now() - startTime);

    // 분당 제한 초과
    if (!minuteResult.success) {
      return {
        allowed: false,
        remaining: minuteResult.remaining,
        resetTime: minuteResult.reset,
        source: 'redis',
        latencyMs,
      };
    }

    // 일일 제한 체크 (설정된 경우)
    if (config.dailyLimit) {
      const dailyLimiter = getOrCreateLimiter(
        `daily:${config.prefix ?? path}`,
        config.dailyLimit,
        24 * 60 * 60 * 1000, // 24시간
        true
      );

      if (dailyLimiter) {
        const dailyResult = await runRedisWithTimeout(
          `rate-limit daily ${identifier}`,
          () => dailyLimiter.limit(identifier),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );

        if (!dailyResult.success) {
          return {
            allowed: false,
            remaining: 0,
            resetTime: dailyResult.reset,
            daily: {
              remaining: dailyResult.remaining,
              resetTime: dailyResult.reset,
            },
            source: 'redis',
            latencyMs: Math.round(performance.now() - startTime),
          };
        }

        // 분당 + 일일 모두 통과
        return {
          allowed: true,
          remaining: minuteResult.remaining,
          resetTime: minuteResult.reset,
          daily: {
            remaining: dailyResult.remaining,
            resetTime: dailyResult.reset,
          },
          source: 'redis',
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // 일일 제한 미설정
    return {
      allowed: true,
      remaining: minuteResult.remaining,
      resetTime: minuteResult.reset,
      source: 'redis',
      latencyMs,
    };
  } catch (error) {
    logger.error('[Redis Rate Limit] Error:', error);
    return null; // 폴백 사용
  }
}
