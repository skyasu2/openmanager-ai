/**
 * 🛡️ Serverless-Compatible Rate Limiter v3.0
 *
 * ✅ **Upstash Redis 우선** (고성능, <1ms 응답)
 * ✅ Supabase 폴백 (Redis 장애 시)
 * ✅ Edge Runtime 지원 (setInterval 제거, on-demand cleanup)
 * ✅ Graceful fallback (모든 서비스 장애 시에도 허용)
 * ✅ 자동 만료 레코드 정리
 * ✅ Atomic operation via RPC (Race condition 완전 해결)
 * ✅ Row Level Security (보안 강화)
 * ✅ 일일 제한 기능 (Cloud Run 무료 티어 최적화)
 *
 * 🔧 Architecture:
 * - **Primary**: Upstash Redis (@upstash/ratelimit)
 * - **Fallback**: Supabase RPC
 * - Supabase 테이블: rate_limits (ip, path, count, reset_time, expires_at)
 * - RPC 함수: check_rate_limit() - Atomic increment with row lock
 * - RPC 함수: cleanup_rate_limits() - Returns actual delete count
 * - RLS 정책: Service role only access (anon key 보호)
 *
 * 🔒 Security:
 * - Row-level locking (FOR UPDATE) prevents race conditions
 * - Service role only access (prevents anon key abuse)
 *
 * 💰 Cloud Run 무료 티어 최적화:
 * - 월 180,000 vCPU-seconds (일 ~6,000초)
 * - AI Engine 평균 실행: 3-5초 (콜드스타트 10초)
 * - 일일 최대 1,500회 용량 → 100회/일 제한으로 안전 마진 확보
 *
 * Changelog:
 * - v3.0 (2025-12-25): **Upstash Redis 통합** (Redis 우선, Supabase 폴백)
 * - v2.2 (2025-12-21): Added daily limit for Cloud Run optimization
 * - v2.1 (2025-11-24): Added RPC functions, RLS policies, atomic operations
 * - v2.0 (2025-11-24): Initial Supabase-based implementation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  checkRedisRateLimit,
  type RateLimitConfig as RedisRateLimitConfig,
} from '../redis/rate-limiter';
import { EdgeLogger } from '../runtime/edge-runtime-utils';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';
import type { RateLimitConfig, RateLimitResult } from './rate-limiter-types';

// ==============================================
// 🏗️ Serverless Rate Limiter 클래스
// ==============================================

class RateLimiter {
  private logger: EdgeLogger;
  private supabase: SupabaseClient | null = null;
  private supabaseInitialized = false;
  /** 🛡️ In-Memory Fallback Rate Limiter (DDoS 방어) */
  private inMemoryLimiter: InMemoryRateLimiter;

  constructor(public config: RateLimitConfig) {
    this.logger = EdgeLogger.getInstance();
    // Supabase client will be initialized lazily on first use

    // In-Memory Fallback 초기화 (Redis + Supabase 장애 시 최후 방어선)
    this.inMemoryLimiter = new InMemoryRateLimiter({
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      dailyLimit: config.dailyLimit,
      maxEntries: 1000, // 최대 1000 IP
      cleanupIntervalMs: 60_000, // 1분마다 정리
      failClosedThreshold: config.maxRequests * 20, // 20배 버스트 허용 후 Fail-Closed
    });
  }

  /**
   * 🔄 Lazy initialization of Supabase client (SSR-compatible)
   */
  private async initializeSupabase(): Promise<void> {
    if (this.supabaseInitialized) return;

    try {
      const { createClient } = await import('@/lib/supabase/server');
      this.supabase = await createClient();
      this.supabaseInitialized = true;
    } catch (error) {
      this.logger.warn(
        'Supabase 비활성화 - Rate limiting graceful fallback',
        error
      );
      this.supabase = null;
      this.supabaseInitialized = true;
    }
  }

  /**
   * 🔍 IP 기반 레이트 리미팅 (Redis 우선, Supabase 폴백)
   *
   * ⚡ 성능 최적화:
   * - 1차: Upstash Redis (<1ms 응답)
   * - 2차: Supabase RPC (Redis 장애 시)
   * - 3차: Graceful fallback (모든 서비스 장애 시)
   *
   * 💰 일일 제한 (Cloud Run 무료 티어):
   * - dailyLimit 설정 시 24시간 윈도우로 추가 체크
   * - 분당 + 일일 제한 모두 통과해야 요청 허용
   */
  async checkLimit(request: NextRequest): Promise<RateLimitResult> {
    const ip = this.getClientIP(request);
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
        // Redis 성공
        this.logger.info(
          `[Rate Limit] Redis 사용 (latency: ${redisResult.latencyMs}ms, IP: ${ip})`
        );
        return {
          allowed: redisResult.allowed,
          remaining: redisResult.remaining,
          resetTime: redisResult.resetTime,
          daily: redisResult.daily,
        };
      }
    } catch (error) {
      this.logger.warn('[Rate Limit] Redis 실패, Supabase 폴백 시도', error);
    }

    // 🔄 2차: Supabase 폴백
    // Lazy initialization (SSR-compatible)
    await this.initializeSupabase();

    // 🛡️ Supabase 비활성화 시 In-Memory Fallback 사용 (DDoS 방어)
    if (!this.supabase) {
      this.logger.warn(
        `[Rate Limit] Redis + Supabase 모두 비활성화 - In-Memory Fallback 사용 (IP: ${ip}, Path: ${path})`
      );
      return this.checkInMemoryFallback(`${ip}:${path}`);
    }

    try {
      // ⚡ 분당 제한 체크 (Atomic RPC 함수)
      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_ip: ip,
        p_path: path,
        p_max_requests: this.config.maxRequests,
        p_window_ms: this.config.windowMs,
      });

      if (error) {
        this.logger.error('[Rate Limit] Supabase RPC 실행 실패', error);
        return this.checkInMemoryFallback(`${ip}:${path}`);
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result) {
        this.logger.error('[Rate Limit] Supabase RPC 결과 없음');
        return this.checkInMemoryFallback(`${ip}:${path}`);
      }

      // 분당 제한 초과 시 즉시 거부
      if (!result.allowed) {
        return {
          allowed: false,
          remaining: result.remaining,
          resetTime: Number(result.reset_time),
        };
      }

      // 💰 일일 제한 체크 (설정된 경우만)
      if (this.config.dailyLimit) {
        const dailyResult = await this.checkDailyLimit(ip, path);

        if (!dailyResult.allowed) {
          this.logger.warn(
            `[Rate Limit] 일일 제한 초과 (IP: ${ip}, Path: ${path})`
          );
          return {
            allowed: false,
            remaining: 0,
            resetTime: dailyResult.resetTime,
            daily: {
              remaining: dailyResult.remaining,
              resetTime: dailyResult.resetTime,
            },
          };
        }

        // 분당 + 일일 모두 통과
        return {
          allowed: true,
          remaining: result.remaining,
          resetTime: Number(result.reset_time),
          daily: {
            remaining: dailyResult.remaining,
            resetTime: dailyResult.resetTime,
          },
        };
      }

      // 일일 제한 미설정 시 분당 결과만 반환
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetTime: Number(result.reset_time),
      };
    } catch (error) {
      this.logger.error('[Rate Limit] 예상치 못한 오류', error);
      return this.checkInMemoryFallback(`${ip}:${path}`);
    }
  }

  /**
   * 📅 일일 제한 체크 (24시간 윈도우)
   *
   * 💰 Cloud Run 무료 티어 최적화:
   * - 월 180,000 vCPU-seconds ÷ 30일 = 일 6,000초
   * - AI Engine 평균 4초 × 100회 = 일 400초 사용
   * - 안전 마진 93% 확보
   */
  private async checkDailyLimit(
    ip: string,
    path: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const dailyWindowMs = 24 * 60 * 60 * 1000; // 24시간

    if (!this.supabase || !this.config.dailyLimit) {
      return {
        allowed: true,
        remaining: this.config.dailyLimit ?? 100,
        resetTime: now + dailyWindowMs,
      };
    }

    try {
      // 일일 제한용 path suffix 추가 (분당과 구분)
      const dailyPath = `${path}:daily`;

      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_ip: ip,
        p_path: dailyPath,
        p_max_requests: this.config.dailyLimit,
        p_window_ms: dailyWindowMs,
      });

      if (error) {
        this.logger.error('[Rate Limit] 일일 제한 RPC 실패', error);
        return {
          allowed: true,
          remaining: this.config.dailyLimit,
          resetTime: now + dailyWindowMs,
        };
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result) {
        return {
          allowed: true,
          remaining: this.config.dailyLimit,
          resetTime: now + dailyWindowMs,
        };
      }

      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetTime: Number(result.reset_time),
      };
    } catch (error) {
      this.logger.error('[Rate Limit] 일일 제한 체크 오류', error);
      return {
        allowed: true,
        remaining: this.config.dailyLimit,
        resetTime: now + dailyWindowMs,
      };
    }
  }

  /**
   * 🌐 클라이언트 IP 주소 추출
   */
  private getClientIP(request: NextRequest): string {
    // Vercel 환경에서는 x-vercel-forwarded-for가 가장 신뢰할 수 있는 IP
    const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip =
      vercelForwarded?.split(',')[0] ??
      forwarded?.split(',')[0] ??
      realIp ??
      'unknown';
    return ip;
  }

  /**
   * 🛡️ In-Memory Fallback (Redis + Supabase 장애 시 최후 방어선)
   *
   * DDoS 공격 방어를 위해 Fail-Open 대신 In-Memory Rate Limiting 적용
   * 글로벌 임계값 초과 시 모든 요청 거부 (Fail-Closed)
   *
   * @param identifier - IP:Path 형식의 고유 식별자
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
   * 🧹 만료된 레코드 정리 (RPC 함수 사용)
   *
   * ✅ 개선사항:
   * - RPC 함수 cleanup_rate_limits() 호출
   * - 실제 삭제 카운트 반환 (기존 버그 수정)
   * - on-demand execution (setInterval 제거)
   */
  async cleanup(): Promise<number> {
    // Lazy initialization (SSR-compatible)
    await this.initializeSupabase();

    if (!this.supabase) {
      return 0;
    }

    try {
      // ✅ RPC 함수 호출 (정확한 삭제 카운트 반환)
      const { data, error } = await this.supabase.rpc('cleanup_rate_limits');

      if (error) {
        this.logger.error('[Rate Limit] 만료 레코드 정리 실패', error);
        return 0;
      }

      const deletedCount = Number(data) || 0;

      if (deletedCount > 0) {
        this.logger.info(
          `[Rate Limit] 만료 레코드 ${deletedCount}개 정리 완료`
        );
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('[Rate Limit] Cleanup 오류', error);
      return 0;
    }
  }
}

// ==============================================
// 🎯 경로별 레이트 리미터 설정
// ==============================================

export const rateLimiters = {
  default: new RateLimiter({ maxRequests: 100, windowMs: 60 * 1000 }), // 1분에 100회
  dataGenerator: new RateLimiter({ maxRequests: 10, windowMs: 60 * 1000 }), // 1분에 10회
  serversNext: new RateLimiter({ maxRequests: 20, windowMs: 60 * 1000 }), // 1분에 20회
  monitoring: new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000 }), // 1분에 30회
  /**
   * 💰 AI Analysis Rate Limiter (보안 강화 + Cloud Run 무료 티어 최적화)
   *
   * @updated 2026-02-19 - Cold Start 재시도 허용 + QA 기반 일일 한도 조정
   * 분당: 10회 (Cold Start 재시도 + Job Queue 전환 허용)
   * 일일: 100회
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
};

// ⚠️ setInterval 제거 (Edge Runtime 비호환)
// 대신 on-demand cleanup (API route에서 호출 가능)

// ==============================================
// 🎯 Rate Limit Middleware
// ==============================================

/**
 * Rate limit middleware wrapper
 * Note: Response 타입도 지원하여 스트리밍 엔드포인트에서 사용 가능
 */
export function withRateLimit(
  rateLimiter: RateLimiter,
  handler: (request: NextRequest) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const result = await rateLimiter.checkLimit(request);

    if (!result.allowed) {
      // 일일 제한 초과 여부에 따라 메시지 분기
      const isDailyLimitExceeded = result.daily && result.daily.remaining <= 0;
      const message = isDailyLimitExceeded
        ? `일일 요청 제한(${rateLimiter.config.dailyLimit ?? 100}회)을 초과했습니다. 내일 다시 시도해주세요.`
        : '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.';

      const headers: Record<string, string> = {
        'X-RateLimit-Limit': rateLimiter.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        'Retry-After': Math.ceil(
          (result.resetTime - Date.now()) / 1000
        ).toString(),
      };

      // 일일 제한 헤더 추가
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
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          remaining: result.remaining,
          resetAt: result.resetTime,
          dailyLimitExceeded: isDailyLimitExceeded,
        },
        { status: 429, headers }
      );
    }

    const response = await handler(request);

    // 성공한 응답에 레이트 리미트 헤더 추가
    response.headers.set(
      'X-RateLimit-Limit',
      rateLimiter.config.maxRequests.toString()
    );
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

    // 일일 제한 헤더 추가 (설정된 경우)
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
