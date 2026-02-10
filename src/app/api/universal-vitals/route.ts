/**
 * 🎯 Universal Vitals API
 *
 * @description 모든 테스트 도구의 Vitals 메트릭을 수집하고 분석하는 통합 API
 * @integration Vitest + Playwright + API Tests + Build Metrics + Infrastructure
 * @features 실시간 수집, 자동 분석, 성능 회귀 감지, 권장사항 제공
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/cors';
import { logger } from '@/lib/logging';
import {
  UNIVERSAL_THRESHOLDS,
  type UniversalVital,
  type VitalCategory,
} from '@/lib/testing/universal-vitals';
import { getErrorMessage } from '@/types/type-utils';

// ⚡ Edge Runtime으로 전환 - 빠른 메트릭 처리
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// 📊 Universal Vitals 요청/응답 타입
interface UniversalVitalsRequest {
  timestamp: number;
  source: string; // 'vitest' | 'playwright' | 'api-test' | 'build' | 'manual'
  sessionId: string;
  metrics: UniversalVital[];
  metadata?: {
    environment?: string;
    branch?: string;
    commit?: string;
    testSuite?: string;
    [key: string]: unknown;
  };
}

interface UniversalVitalsResponse {
  success: boolean;
  timestamp: number;
  data?: {
    processed: number;
    analysis: VitalsAnalysis;
    recommendations: string[];
    regressions?: RegressionAlert[];
  };
  error?: string;
}

interface VitalsAnalysis {
  overall: 'good' | 'needs-improvement' | 'poor';
  score: number; // 0-100
  breakdown: {
    [category in VitalCategory]?: {
      count: number;
      good: number;
      needsImprovement: number;
      poor: number;
      avgValue: number;
    };
  };
}

interface RegressionAlert {
  metric: string;
  category: VitalCategory;
  previousValue: number;
  currentValue: number;
  regressionPercent: number;
  severity: 'low' | 'medium' | 'high';
}

// 🧮 Universal Vitals 분석 엔진
class UniversalVitalsAnalyzer {
  // 📈 전체 Vitals 분석
  analyze(metrics: UniversalVital[]): VitalsAnalysis {
    if (metrics.length === 0) {
      return {
        overall: 'good',
        score: 100,
        breakdown: {},
      };
    }

    const breakdown: VitalsAnalysis['breakdown'] = {};
    let totalScore = 0;
    let categoryCount = 0;

    // 카테고리별 분석
    const categorizedMetrics = this.groupByCategory(metrics);

    for (const [category, categoryMetrics] of categorizedMetrics.entries()) {
      const analysis = this.analyzeCategoryMetrics(category, categoryMetrics);
      breakdown[category] = analysis;

      // 카테고리 점수 계산
      const categoryScore = this.calculateCategoryScore(analysis);
      totalScore += categoryScore;
      categoryCount++;
    }

    // 전체 점수 및 등급 계산
    const overallScore =
      categoryCount > 0 ? Math.round(totalScore / categoryCount) : 100;
    const overall = this.determineOverallRating(overallScore);

    return {
      overall,
      score: overallScore,
      breakdown,
    };
  }

  // 🏷️ 메트릭을 카테고리별로 그룹화
  private groupByCategory(
    metrics: UniversalVital[]
  ): Map<VitalCategory, UniversalVital[]> {
    const grouped = new Map<VitalCategory, UniversalVital[]>();

    metrics.forEach((metric) => {
      let bucket = grouped.get(metric.category);
      if (!bucket) {
        bucket = [];
        grouped.set(metric.category, bucket);
      }
      bucket.push(metric);
    });

    return grouped;
  }

  // 📊 카테고리별 메트릭 분석
  private analyzeCategoryMetrics(
    _category: VitalCategory, // 향후 카테고리별 가중치 적용 예정
    metrics: UniversalVital[]
  ) {
    const good = metrics.filter((m) => m.rating === 'good').length;
    const needsImprovement = metrics.filter(
      (m) => m.rating === 'needs-improvement'
    ).length;
    const poor = metrics.filter((m) => m.rating === 'poor').length;
    const avgValue =
      metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;

    return {
      count: metrics.length,
      good,
      needsImprovement,
      poor,
      avgValue: Math.round(avgValue * 100) / 100,
    };
  }

  // 🎯 카테고리 점수 계산
  private calculateCategoryScore(
    analysis: NonNullable<VitalsAnalysis['breakdown'][VitalCategory]>
  ): number {
    const total = analysis.count;
    if (total === 0) return 100;

    // 가중치 기반 점수 계산
    const goodScore = (analysis.good / total) * 100;
    const needsImprovementScore = (analysis.needsImprovement / total) * 60;
    const poorScore = (analysis.poor / total) * 20;

    return Math.round(goodScore + needsImprovementScore + poorScore);
  }

  // ⚖️ 전체 등급 결정
  private determineOverallRating(
    score: number
  ): 'good' | 'needs-improvement' | 'poor' {
    if (score >= 80) return 'good';
    if (score >= 60) return 'needs-improvement';
    return 'poor';
  }

  // 💡 권장사항 생성
  generateRecommendations(metrics: UniversalVital[]): string[] {
    const recommendations: string[] = [];
    const categorizedMetrics = this.groupByCategory(metrics);

    categorizedMetrics.forEach((categoryMetrics, category) => {
      const poorMetrics = categoryMetrics.filter((m) => m.rating === 'poor');

      if (poorMetrics.length > 0) {
        switch (category) {
          case 'test-execution':
            if (poorMetrics.some((m) => m.name.includes('test-time'))) {
              recommendations.push(
                '테스트 실행 시간 최적화 필요 - 병렬 실행 검토'
              );
            }
            if (poorMetrics.some((m) => m.name.includes('success-rate'))) {
              recommendations.push(
                '테스트 안정성 개선 필요 - Flaky 테스트 분석'
              );
            }
            break;

          case 'api-performance':
            if (poorMetrics.some((m) => m.name.includes('response-time'))) {
              recommendations.push('API 응답 시간 개선 - 캐싱 및 쿼리 최적화');
            }
            if (poorMetrics.some((m) => m.name.includes('error-rate'))) {
              recommendations.push('API 오류율 감소 - 에러 핸들링 강화');
            }
            break;

          case 'build-performance':
            if (poorMetrics.some((m) => m.name.includes('build-time'))) {
              recommendations.push(
                '빌드 시간 단축 - 번들러 최적화 및 캐싱 활용'
              );
            }
            if (poorMetrics.some((m) => m.name.includes('bundle-size'))) {
              recommendations.push(
                '번들 크기 최적화 - 코드 스플리팅 및 Tree Shaking'
              );
            }
            break;

          case 'infrastructure':
            if (poorMetrics.some((m) => m.name.includes('memory'))) {
              recommendations.push('메모리 사용량 최적화 - 메모리 누수 검사');
            }
            if (poorMetrics.some((m) => m.name.includes('cpu'))) {
              recommendations.push('CPU 사용률 개선 - 알고리즘 최적화');
            }
            break;
        }
      }
    });

    return recommendations;
  }

  // 🚨 회귀 감지 (간단한 버전 - 실제로는 히스토리 데이터 필요)
  detectRegressions(
    currentMetrics: UniversalVital[],
    previousMetrics?: UniversalVital[]
  ): RegressionAlert[] {
    if (!previousMetrics || previousMetrics.length === 0) {
      return [];
    }

    const alerts: RegressionAlert[] = [];

    currentMetrics.forEach((current) => {
      const previous = previousMetrics.find(
        (p) => p.name === current.name && p.category === current.category
      );

      if (previous && current.value > previous.value) {
        const regressionPercent =
          ((current.value - previous.value) / previous.value) * 100;

        // 20% 이상 성능 저하 시 경고
        if (regressionPercent > 20) {
          let severity: RegressionAlert['severity'] = 'low';
          if (regressionPercent > 50) severity = 'high';
          else if (regressionPercent > 30) severity = 'medium';

          alerts.push({
            metric: current.name,
            category: current.category,
            previousValue: previous.value,
            currentValue: current.value,
            regressionPercent,
            severity,
          });
        }
      }
    });

    return alerts;
  }
}

// 🏭 분석 엔진 인스턴스
const analyzer = new UniversalVitalsAnalyzer();

/**
 * 📤 POST /api/universal-vitals
 * Universal Vitals 메트릭 수집 및 분석
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    // 요청 데이터 파싱
    const body = (await request.json()) as UniversalVitalsRequest;

    // 기본 검증
    if (!body.metrics || !Array.isArray(body.metrics)) {
      return NextResponse.json(
        { success: false, error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // 메트릭 분석
    const analysis = analyzer.analyze(body.metrics);
    const recommendations = analyzer.generateRecommendations(body.metrics);

    // 회귀 감지 (실제로는 히스토리 데이터와 비교)
    const regressions = analyzer.detectRegressions(body.metrics);

    const processingTime = Date.now() - startTime;

    // 📈 응답 데이터
    const response: UniversalVitalsResponse = {
      success: true,
      timestamp: Date.now(),
      data: {
        processed: body.metrics.length,
        analysis,
        recommendations,
        regressions: regressions.length > 0 ? regressions : undefined,
      },
    };

    // 🚀 Edge Runtime 최적화 헤더
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Edge-Runtime': 'vercel',
      'X-Processing-Time': processingTime.toString(),
      'X-Metrics-Processed': body.metrics.length.toString(),
      ...getCorsHeaders(origin),
    });

    // 📝 개발 환경에서 로깅
    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `📊 [Universal Vitals] ${body.source}에서 ${body.metrics.length}개 메트릭 처리`
      );
      logger.info(`🎯 전체 점수: ${analysis.score}점 (${analysis.overall})`);
      if (recommendations.length > 0) {
        logger.info(`💡 권장사항 ${recommendations.length}개 제공`);
      }
      if (regressions.length > 0) {
        logger.info(`🚨 성능 회귀 ${regressions.length}개 감지`);
      }
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    logger.error('Universal Vitals API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Universal Vitals processing failed',
        message: getErrorMessage(error),
        timestamp: Date.now(),
      } as UniversalVitalsResponse,
      { status: 500 }
    );
  }
}

/**
 * 🔍 GET /api/universal-vitals
 * Universal Vitals 시스템 상태 및 설정 정보
 */
export function GET() {
  const supportedCategories = Object.keys(
    UNIVERSAL_THRESHOLDS
  ) as VitalCategory[];

  const response = {
    success: true,
    service: 'Universal Vitals Collection API',
    runtime: 'edge',
    version: '1.0.0',
    features: [
      'Multi-tool vitals collection (Vitest, Playwright, API, Build)',
      'Real-time performance analysis',
      'Automated regression detection',
      'Smart recommendations engine',
      'Edge Runtime optimized processing',
    ],
    supportedCategories,
    thresholds: UNIVERSAL_THRESHOLDS,
    exampleUsage: {
      vitest: 'Use VitestVitals plugin for automatic collection',
      playwright: 'Use PlaywrightVitals for E2E metrics',
      api: 'Use startAPI/endAPI helpers',
      manual: 'POST metrics directly to this endpoint',
    },
    timestamp: Date.now(),
  };

  return NextResponse.json(response, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'X-Runtime': 'edge',
    },
  });
}

/**
 * 🔧 OPTIONS /api/universal-vitals
 * CORS 및 프리플라이트 요청 처리
 */
export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin),
      'X-Runtime': 'edge',
    },
  });
}
