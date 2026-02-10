/**
 * 🚀 통합 캐시 API
 *
 * 캐시 통계 및 최적화 기능 통합
 *
 * v5.84.1 변경사항:
 * - /api/cache/stats, /api/cache/optimize 기능 통합
 * - GET: 캐시 통계 조회
 * - POST: 캐시 작업 (warmup, invalidate, optimize, reset-stats)
 *
 * GET /api/cache
 *   - 캐시 통계 조회 (기존 /api/cache/stats)
 *
 * POST /api/cache
 *   - action: 'warmup' | 'invalidate' | 'optimize' | 'reset-stats'
 *   - options: { targets?: string[], pattern?: string }
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAdminAuth, withAuth } from '@/lib/auth/api-auth';
import {
  getCacheStats,
  invalidateCache,
  unifiedCache,
} from '@/lib/cache/unified-cache';
import type {
  CacheInvalidateResponse,
  CacheOptimizeResponse,
  CachePerformance,
  CacheResetStatsResponse,
  CacheStats,
  CacheWarmupResponse,
} from '@/schemas/api.schema';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// GET Handler - Cache Stats
// ============================================================================

async function handleGET(_request: NextRequest) {
  try {
    const rawStats = getCacheStats();

    const stats: CacheStats = {
      hits: rawStats.hits || 0,
      misses: rawStats.misses || 0,
      errors: 0,
      commands: rawStats.sets + rawStats.deletes || 0,
      memoryUsage: Math.round(rawStats.size * 0.5) || 0,
      storeSize: rawStats.size || 0,
      hitRate: rawStats.hitRate || 0,
      commandsPerSecond: 0,
      memoryUsageMB:
        Math.round(((rawStats.size * 0.5) / 1024) * 100) / 100 || 0,
    };

    const memoryUsage = estimateMemoryCacheUsage();
    const performance = analyzePerformance(stats);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        stats: { ...stats, performance },
        memory: memoryUsage,
      },
      {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Cache-Type': 'Memory-based',
        },
      }
    );
  } catch (error) {
    debug.error('❌ Cache stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: '캐시 통계 조회 실패',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Cache Actions
// ============================================================================

async function handlePOST(request: NextRequest) {
  try {
    const { action, options } = await request.json();

    debug.log('🔧 Cache action:', action, options);

    switch (action) {
      case 'warmup':
        return NextResponse.json(await handleWarmup(options));

      case 'invalidate':
        return NextResponse.json(await handleInvalidate(options));

      case 'optimize':
        return NextResponse.json(await handleOptimize());

      case 'reset-stats':
        return NextResponse.json(await handleResetStats());

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            availableActions: [
              'warmup',
              'invalidate',
              'optimize',
              'reset-stats',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    debug.error('❌ Cache action failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: '캐시 작업 실패',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function estimateMemoryCacheUsage() {
  const stats = getCacheStats();
  const itemSizeEstimate = 0.5;
  const estimatedKB = Math.round(stats.size * itemSizeEstimate);
  const estimatedMB = estimatedKB / 1024;
  const maxMB = 50;
  const usagePercent = (estimatedMB / maxMB) * 100;

  return {
    estimatedMB: Math.round(estimatedMB * 100) / 100,
    maxMB,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

function analyzePerformance(stats: CacheStats): CachePerformance {
  const totalOps = stats.hits + stats.misses;
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  const issues: string[] = [];

  if (stats.hitRate < 40) {
    grade = 'F';
    issues.push('매우 낮은 캐시 히트율');
  } else if (stats.hitRate < 50) {
    grade = 'D';
    issues.push('낮은 캐시 히트율');
  } else if (stats.hitRate < 65) {
    grade = 'C';
    issues.push('보통 수준의 캐시 효율성');
  } else if (stats.hitRate < 80) {
    grade = 'B';
    issues.push('양호한 캐시 효율성');
  } else {
    issues.push('우수한 캐시 효율성');
  }

  if (stats.storeSize > 800) {
    grade = grade < 'C' ? grade : 'C';
    issues.push('캐시 크기가 제한에 근접');
  }

  return {
    grade,
    hitRate: stats.hitRate,
    errorRate: '0.00',
    issues,
    totalOperations: totalOps,
    recommendations: getRecommendations(stats),
  };
}

function getRecommendations(stats: CacheStats): string[] {
  const recommendations: string[] = [];

  if (stats.hitRate < 50) {
    recommendations.push('TTL 값을 늘려 캐시 보존 시간을 연장하세요');
  }

  if (stats.storeSize > 700) {
    recommendations.push('캐시 크기 제한이 가까워졌습니다');
  }

  if (recommendations.length === 0 && stats.hitRate >= 70) {
    recommendations.push('캐시 성능이 우수합니다!');
  }

  recommendations.push('✅ 메모리 기반 캐싱 최적화 상태');

  return recommendations;
}

async function handleWarmup(options?: {
  targets?: string[];
  pattern?: string;
}): Promise<CacheWarmupResponse> {
  const warmupItems = [];

  if (!options?.targets || options.targets.includes('servers')) {
    warmupItems.push({
      key: 'servers:list',
      fetcher: async () => metricsProvider.getAllServerMetrics(),
      ttl: 300,
    });
  }

  if (!options?.targets || options.targets.includes('summary')) {
    warmupItems.push({
      key: 'servers:summary',
      fetcher: async () => {
        const summary = metricsProvider.getSystemSummary();
        return {
          totalServers: summary.totalServers,
          onlineServers: summary.onlineServers,
          avgCpuUsage: summary.averageCpu,
          timestamp: Date.now(),
        };
      },
      ttl: 900,
    });
  }

  await Promise.allSettled(
    warmupItems.map(async (item) => {
      const data = await item.fetcher();
      await unifiedCache.set(item.key, data, { ttlSeconds: item.ttl });
    })
  );

  return {
    success: true,
    message: `${warmupItems.length}개 항목 워밍업 완료`,
    items: warmupItems.map((item) => item.key),
  };
}

async function handleInvalidate(options?: {
  targets?: string[];
  pattern?: string;
}): Promise<CacheInvalidateResponse> {
  await invalidateCache(options?.pattern);

  return {
    success: true,
    message: options?.pattern
      ? `패턴 '${options.pattern}'에 해당하는 캐시 무효화 완료`
      : '전체 캐시 무효화 완료',
  };
}

async function handleOptimize(): Promise<CacheOptimizeResponse> {
  const cache = unifiedCache;
  const stats = cache.getStats();
  const optimizations: string[] = [];

  if (stats.hitRate < 70) {
    await handleWarmup({ targets: ['servers', 'summary'] });
    optimizations.push('주요 데이터 사전 캐싱 완료');
  }

  const memoryUsageKB = parseInt(stats.memoryUsage.replace('KB', ''), 10) || 0;
  if (memoryUsageKB > 200000) {
    await invalidateCache('realtime');
    optimizations.push('실시간 데이터 캐시 정리 완료');
  }

  const rawStats = cache.getStats();
  const newStats: CacheStats = {
    hits: rawStats.hits || 0,
    misses: rawStats.misses || 0,
    errors: 0,
    commands: rawStats.sets + rawStats.deletes || 0,
    memoryUsage: memoryUsageKB / 1024,
    storeSize: rawStats.size || 0,
    hitRate: rawStats.hitRate || 0,
    commandsPerSecond: 0,
    memoryUsageMB: memoryUsageKB / 1024,
  };

  return {
    success: true,
    message: '캐시 최적화 완료',
    optimizations,
    newStats,
  };
}

async function handleResetStats(): Promise<CacheResetStatsResponse> {
  const cache = unifiedCache;
  await unifiedCache.invalidate('*');

  const rawStats = cache.getStats();
  const memoryUsageKB =
    parseInt(rawStats.memoryUsage.replace('KB', ''), 10) || 0;
  const newStats: CacheStats = {
    hits: rawStats.hits || 0,
    misses: rawStats.misses || 0,
    errors: 0,
    commands: rawStats.sets + rawStats.deletes || 0,
    memoryUsage: memoryUsageKB / 1024,
    storeSize: rawStats.size || 0,
    hitRate: rawStats.hitRate || 0,
    commandsPerSecond: 0,
    memoryUsageMB: memoryUsageKB / 1024,
  };

  return {
    success: true,
    message: '캐시 통계 리셋 완료',
    newStats,
  };
}

// 인증 래핑: GET은 일반 인증, POST(무효화/리셋)는 관리자 인증
export const GET = withAuth(handleGET);
export const POST = withAdminAuth(handlePOST);
