/**
 * 🛡️ Serverless-Compatible Rate Limiter v4.0
 *
 * ✅ **Upstash Redis 우선** (고성능, <1ms 응답)
 * ✅ Edge Runtime 지원 (setInterval 제거, on-demand cleanup)
 * ✅ Graceful fallback (Redis 장애 시에도 In-Memory로 허용)
 * ✅ 일일 제한 기능 (Cloud Run 무료 티어 최적화)
 *
 * 🔧 Architecture: Redis (primary) → In-Memory (guaranteed fallback)
 *
 * 💰 Cloud Run 무료 티어 최적화:
 * - 월 180,000 vCPU-seconds (일 ~6,000초)
 * - AI Engine 평균 실행: 3-5초 (콜드스타트 10초)
 * - 일일 최대 1,500회 용량 → 100회/일 제한으로 안전 마진 확보
 *
 * Changelog:
 * - v4.0 (2026-04-10): Supabase RPC 경로 제거 — Redis + In-Memory 2-tier로 확정
 * - v3.0 (2025-12-25): Upstash Redis 통합 (Redis 우선, legacy Supabase RPC 폴백)
 * - v2.2 (2025-12-21): Added daily limit for Cloud Run optimization
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  checkRedisRateLimit,
  type RateLimitConfig as RedisRateLimitConfig,
} from '../redis/rate-limiter';
import { EdgeLogger } from '../runtime/edge-runtime-utils';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';
import { getRateLimitIdentity } from './rate-limit-identity';
import type { RateLimitConfig, RateLimitResult } from './rate-limiter-types';

// ==============================================
// 🏗️ Serverless Rate Limiter 클래스
// ==============================================

class RateLimiter {
  private logger: EdgeLogger;
  /** 🛡️ In-Memory Fallback Rate Limiter (Redis 장애 시 최후 방어선) */
  private inMemoryLimiter: InMemoryRateLimiter;

  constructor(public config: RateLimitConfig) {
    this.logger = EdgeLogger.getInstance();

    this.inMemoryLimiter = new InMemoryRateLimiter({
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      dailyLimit: config.dailyLimit,
      maxEntries: 1000,
      cleanupIntervalMs: 60_000,
      failClosedThreshold: config.maxRequests * 20,
    });
  }

  /**
   * 🔍 IP 기반 레이트 리미팅 (Redis 우선, In-Memory fallback)
   *
   * ⚡ 성능 최적화:
   * - 1차: Upstash Redis (<1ms 응답, dailyLimit 포함)
   * - 2차: In-Memory fallback (Redis 불가 시)
   */
  async checkLimit(request: NextRequest): Promise<RateLimitResult> {
    const identity = getRateLimitIdentity(request);
    const path = request.nextUrl.pathname;

    // 🚀 1차: Redis Rate Limit 시도 (고성능)
    try {
      const redisConfig: RedisRateLimitConfig = {
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
        dailyLimit: this.config.dailyLimit,
        prefix: path.replace(/\//g, ':'),
      };

      const redisResult = await checkRedisRateLimit(request, redisConfig);

      if (redisResult) {
        this.logger.info(
          `[Rate Limit] Redis 사용 (latency: ${redisResult.latencyMs}ms, identity: ${identity})`
        );
        return {
          allowed: redisResult.allowed,
          remaining: redisResult.remaining,
          resetTime: redisResult.resetTime,
          daily: redisResult.daily,
        };
      }
    } catch (error) {
      this.logger.warn(
        '[Rate Limit] Redis 실패, In-Memory fallback 사용',
        error
      );
    }

    // 🛡️ 2차: In-Memory Fallback
    this.logger.warn(
      `[Rate Limit] Redis 비활성화 - In-Memory Fallback 사용 (identity: ${identity}, Path: ${path})`
    );
    return this.checkInMemoryFallback(`${identity}:${path}`);
  }

  /**
   * 🛡️ In-Memory Fallback (Redis unavailable 시 최후 방어선)
   *
   * DDoS 공격 방어를 위해 Fail-Open 대신 In-Memory Rate Limiting 적용
   * 글로벌 임계값 초과 시 모든 요청 거부 (Fail-Closed)
   */
  private checkInMemoryFallback(identifier: string): RateLimitResult {
    const result = this.inMemoryLimiter.checkLimit(identifier);

    if (!result.allowed) {
      this.logger.warn(
        `[Rate Limit] In-Memory Fallback 거부: ${identifier} (reason: ${result.reason})`
      );
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: result.resetTime,
      daily: result.daily,
    };
  }

  /**
   * 🧹 만료된 레코드 정리 (In-Memory 전용)
   */
  cleanup(): number {
    return 0;
  }
}

// ==============================================
// 🎯 경로별 레이트 리미터 설정
// ==============================================

export const rateLimiters = {
  default: new RateLimiter({ maxRequests: 100, windowMs: 60 * 1000 }),
  dataGenerator: new RateLimiter({ maxRequests: 10, windowMs: 60 * 1000 }),
  serversNext: new RateLimiter({ maxRequests: 20, windowMs: 60 * 1000 }),
  monitoring: new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000 }),
  /**
   * 💰 AI Analysis Rate Limiter (보안 강화 + Cloud Run 무료 티어 최적화)
   *
   * @updated 2026-02-19 - Cold Start 재시도 허용 + QA 기반 일일 한도 조정
   * 분당: 10회 / 일일: 100회
   *
   * 계산 근거:
   * - Cloud Run 무료: 월 180,000 vCPU-seconds
   * - 일일 용량: 6,000초 / AI Engine 4초 = 1,500회
   * - 안전 마진: 100회/일 × 4초 = 400초/일 (용량의 6.7%)
   */
  aiAnalysis: new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    dailyLimit: 100,
  }),
  /**
   * Job creation should fail fast at the edge with the same minute window
   * the upstream Cloud Run queue enforces, instead of drifting at 10/min.
   */
  aiJobCreation: new RateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000,
    dailyLimit: 100,
  }),
};

const RETRY_AFTER_JITTER_MAX_SECONDS = 2;

function withRetryAfterJitter(
  baseSeconds: number,
  scope: 'minute' | 'daily'
): number {
  const normalizedBase = Math.max(1, Math.ceil(baseSeconds));
  if (scope === 'daily') {
    return normalizedBase;
  }
  const jitter = Math.floor(
    Math.random() * (RETRY_AFTER_JITTER_MAX_SECONDS + 1)
  );
  return normalizedBase + jitter;
}

// ==============================================
// 🎯 Rate Limit Middleware
// ==============================================

/**
 * Rate limit middleware wrapper
 * Note: Response 타입도 지원하여 스트리밍 엔드포인트에서 사용 가능
 */
export function withRateLimit<TArgs extends unknown[]>(
  rateLimiter: RateLimiter,
  handler: (
    request: NextRequest,
    ...args: TArgs
  ) => Promise<NextResponse | Response>
) {
  return async (
    request: NextRequest,
    ...args: TArgs
  ): Promise<NextResponse | Response> => {
    const result = await rateLimiter.checkLimit(request);

    if (!result.allowed) {
      const isDailyLimitExceeded = result.daily && result.daily.remaining <= 0;
      const retryAfter = withRetryAfterJitter(
        (result.resetTime - Date.now()) / 1000,
        isDailyLimitExceeded ? 'daily' : 'minute'
      );
      const message = isDailyLimitExceeded
        ? `일일 요청 제한(${rateLimiter.config.dailyLimit ?? 100}회)을 초과했습니다. 내일 다시 시도해주세요.`
        : '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.';

      const headers: Record<string, string> = {
        'X-RateLimit-Limit': rateLimiter.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        'Retry-After': retryAfter.toString(),
      };

      if (result.daily) {
        headers['X-RateLimit-Daily-Limit'] = (
          rateLimiter.config.dailyLimit ?? 100
        ).toString();
        headers['X-RateLimit-Daily-Remaining'] =
          result.daily.remaining.toString();
        headers['X-RateLimit-Daily-Reset'] = result.daily.resetTime.toString();
      }

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message,
          source: 'frontend-gateway',
          limitScope: isDailyLimitExceeded ? 'daily' : 'minute',
          retryAfter,
          remaining: result.remaining,
          resetAt: result.resetTime,
          dailyLimitExceeded: isDailyLimitExceeded,
        },
        { status: 429, headers }
      );
    }

    const response = await handler(request, ...args);

    response.headers.set(
      'X-RateLimit-Limit',
      rateLimiter.config.maxRequests.toString()
    );
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

    if (result.daily) {
      response.headers.set(
        'X-RateLimit-Daily-Limit',
        (rateLimiter.config.dailyLimit ?? 100).toString()
      );
      response.headers.set(
        'X-RateLimit-Daily-Remaining',
        result.daily.remaining.toString()
      );
      response.headers.set(
        'X-RateLimit-Daily-Reset',
        result.daily.resetTime.toString()
      );
    }

    return response;
  };
}
