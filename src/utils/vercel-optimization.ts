/**
 * 🚀 Vercel 환경 최적화 유틸리티
 *
 * AI 교차검증 기반 Vercel 특화 최적화:
 * - Edge Runtime 호환성
 * - Cold Start 최소화
 * - 메모리 효율성
 * - 캐싱 전략
 */

/**
 * Vercel 환경 정보
 */
import { logger } from '@/lib/logging';

interface VercelEnvironment {
  isVercel: boolean;
  region: string;
  environment: 'production' | 'preview' | 'development';
  deploymentUrl?: string;
  gitBranch?: string;
}

/**
 * Vercel 환경 감지 및 정보 수집
 */
function getVercelEnvironment(): VercelEnvironment {
  // 서버 환경에서는 process.env 사용
  if (typeof window === 'undefined') {
    const vercelEnv = process.env.VERCEL_ENV;
    const environment: 'production' | 'preview' | 'development' =
      vercelEnv === 'production' || vercelEnv === 'preview'
        ? vercelEnv
        : 'development';

    return {
      isVercel: process.env.VERCEL === '1',
      region: process.env.VERCEL_REGION || 'unknown',
      environment,
      deploymentUrl: process.env.VERCEL_URL,
      gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    };
  }

  // 클라이언트 환경에서는 URL 기반 감지
  const hostname = window.location.hostname;
  const isVercel = hostname.includes('vercel.app');

  return {
    isVercel,
    region: 'client-side', // 클라이언트에서는 region 정보 없음
    environment: isVercel
      ? hostname.includes('-git-')
        ? 'preview'
        : 'production'
      : 'development',
    deploymentUrl: isVercel ? hostname : undefined,
    gitBranch:
      isVercel && hostname.includes('-git-')
        ? hostname.split('-git-')[1]?.split('-')[0]
        : undefined,
  };
}

/**
 * 성능 메트릭 수집 (Vercel Analytics 호환)
 */
export class VercelPerformanceTracker {
  private metrics: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * 성능 측정 시작
   */
  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  /**
   * 성능 측정 종료 및 기록
   */
  end(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      logger.warn(`⚠️ 성능 측정 시작점을 찾을 수 없음: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.set(label, duration);
    this.startTimes.delete(label);

    // Vercel 환경에서는 console.log가 모니터링됨
    if (getVercelEnvironment().isVercel) {
      logger.info(`📊 Vercel Performance [${label}]: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * 모든 메트릭 가져오기
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * 메트릭 초기화
   */
  clear(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

/**
 * 전역 성능 트래커 인스턴스
 */
export const performanceTracker = new VercelPerformanceTracker();

/**
 * Cold Start 최소화를 위한 사전 로딩
 */
export async function preloadCriticalResources(): Promise<void> {
  const env = getVercelEnvironment();

  if (!env.isVercel) return; // 로컬 환경에서는 스킵

  performanceTracker.start('preload-resources');

  try {
    // 1. DNS 사전 해결
    if (typeof document !== 'undefined') {
      const criticalDomains = [
        'https://api.supabase.co',
        'https://fonts.googleapis.com',
      ];

      criticalDomains.forEach((domain) => {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = domain;
        document.head.appendChild(link);
      });
    }

    // 2. 중요 API 엔드포인트 사전 로딩 (HEAD 요청)
    const criticalEndpoints = ['/api/system'];

    await Promise.allSettled(
      criticalEndpoints.map(async (endpoint) => {
        try {
          await fetch(endpoint, { method: 'HEAD' });
        } catch {
          // 실패해도 계속 진행 (사전 로딩이므로)
        }
      })
    );

    logger.info('🚀 Vercel 사전 로딩 완료');
  } catch (error) {
    logger.warn('⚠️ 사전 로딩 중 일부 실패:', error);
  } finally {
    performanceTracker.end('preload-resources');
  }
}

// 초기화 로그 (빌드 중에는 스킵)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  logger.info('🚀 Vercel 최적화 유틸리티 초기화됨:', getVercelEnvironment());
}
