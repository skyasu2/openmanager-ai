/**
 * 🚀 Web Vitals 수집 API - Edge Runtime 최적화
 *
 * Core Web Vitals 메트릭 수집 및 분석
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - CLS (Cumulative Layout Shift)
 * - FID (First Input Delay)
 * - INP (Interaction to Next Paint)
 *
 * Edge Runtime으로 글로벌 배포 및 초저지연 수집
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/cors';
import { logger } from '@/lib/logging';
import { getErrorMessage } from '@/types/type-utils';

// ⚡ Edge Runtime으로 전환 - 무료 티어 친화적 최적화
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// 📊 Web Vitals 메트릭 타입 정의
interface WebVitalMetric {
  name: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'INP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  entries?: Array<{
    name?: string;
    entryType?: string;
    startTime?: number;
    duration?: number;
    [key: string]: unknown;
  }>;
}

interface WebVitalsData {
  url: string;
  userAgent: string;
  timestamp: number;
  metrics: WebVitalMetric[];
  sessionId: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
}

// 🎯 Web Vitals 임계값 (Google 권장 기준)
const VITALS_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // ms
  LCP: { good: 2500, poor: 4000 }, // ms
  CLS: { good: 0.1, poor: 0.25 }, // score
  FID: { good: 100, poor: 300 }, // ms
  INP: { good: 200, poor: 500 }, // ms
  TTFB: { good: 800, poor: 1800 }, // ms
} as const;

// 📈 메트릭 등급 계산
function calculateRating(
  name: keyof typeof VITALS_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = VITALS_THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// 📱 디바이스 타입 감지
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua))
    return 'tablet';
  if (
    /mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
      ua
    )
  )
    return 'mobile';
  return 'desktop';
}

// 🔍 Web Vitals 분석
function analyzeWebVitals(data: WebVitalsData) {
  const analysis = {
    overall: 'good' as 'good' | 'needs-improvement' | 'poor',
    score: 100,
    insights: [] as string[],
    recommendations: [] as string[],
  };

  let poorCount = 0;
  let needsImprovementCount = 0;

  data.metrics.forEach((metric) => {
    if (metric.rating === 'poor') {
      poorCount++;
      analysis.insights.push(
        `${metric.name}: ${metric.value}${metric.name === 'CLS' ? '' : 'ms'} (Poor)`
      );
    } else if (metric.rating === 'needs-improvement') {
      needsImprovementCount++;
      analysis.insights.push(
        `${metric.name}: ${metric.value}${metric.name === 'CLS' ? '' : 'ms'} (Needs Improvement)`
      );
    }
  });

  // 전체 등급 결정
  if (poorCount > 0) {
    analysis.overall = 'poor';
    analysis.score = Math.max(0, 60 - poorCount * 20);
  } else if (needsImprovementCount > 0) {
    analysis.overall = 'needs-improvement';
    analysis.score = Math.max(60, 80 - needsImprovementCount * 5);
  } else {
    analysis.overall = 'good';
    analysis.score = 100;
  }

  // 개선 권장사항
  if (data.metrics.some((m) => m.name === 'LCP' && m.rating !== 'good')) {
    analysis.recommendations.push('이미지 최적화 (WebP/AVIF 형식 사용)');
    analysis.recommendations.push('CDN 활용으로 컨텐츠 배포 최적화');
  }

  if (data.metrics.some((m) => m.name === 'CLS' && m.rating !== 'good')) {
    analysis.recommendations.push('레이아웃 시프트 최소화 (이미지 크기 명시)');
    analysis.recommendations.push('폰트 로딩 최적화');
  }

  if (data.metrics.some((m) => m.name === 'FID' && m.rating !== 'good')) {
    analysis.recommendations.push('JavaScript 실행 시간 최소화');
    analysis.recommendations.push('코드 스플리팅으로 번들 크기 감소');
  }

  return analysis;
}

/**
 * 📊 POST /api/web-vitals
 * Web Vitals 메트릭 수집 및 분석
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    // 요청 데이터 파싱
    const body = (await request.json()) as WebVitalsData;

    // 기본 검증
    if (!body.metrics || !Array.isArray(body.metrics)) {
      return NextResponse.json(
        { success: false, error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // 메트릭 등급 계산
    const processedMetrics = body.metrics.map((metric) => ({
      ...metric,
      rating: calculateRating(metric.name, metric.value),
    }));

    // 디바이스 타입 감지
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Web Vitals 분석
    const analysis = analyzeWebVitals({
      ...body,
      metrics: processedMetrics,
      deviceType,
    });

    const processingTime = Date.now() - startTime;

    // 📈 응답 데이터
    const response = {
      success: true,
      timestamp: Date.now(),
      data: {
        url: body.url,
        deviceType,
        sessionId: body.sessionId,
        metrics: processedMetrics,
        analysis,
        performance: {
          processingTime,
          edgeRegion: request.headers.get('cf-ray') || 'unknown',
          runtime: 'edge',
        },
      },
    };

    // 🚀 Edge Runtime 최적화 헤더
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store', // 실시간 데이터
      'X-Edge-Runtime': 'vercel',
      'X-Processing-Time': processingTime.toString(),
      'X-Device-Type': deviceType,
      ...getCorsHeaders(origin),
    });

    return NextResponse.json(response, { headers });
  } catch (error) {
    logger.error('Web Vitals API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Web Vitals processing failed',
        message: getErrorMessage(error),
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

/**
 * 🏓 GET /api/web-vitals
 * Web Vitals 수집 상태 및 설정 정보
 */
export function GET() {
  const response = {
    success: true,
    service: 'Web Vitals Collection API',
    runtime: 'edge',
    features: [
      'Core Web Vitals 실시간 수집',
      'Google 권장 기준 자동 등급 평가',
      '디바이스별 분석',
      'Edge Runtime 초저지연 처리',
      '자동 성능 권장사항 제공',
    ],
    thresholds: VITALS_THRESHOLDS,
    supportedMetrics: ['FCP', 'LCP', 'CLS', 'FID', 'INP', 'TTFB'],
    timestamp: Date.now(),
    version: '1.0.0',
  };

  // 📦 STATIC: 1시간 TTL, SWR 비활성화 (설정 정보)
  // 설정 정보는 거의 변경되지 않으므로 SWR 불필요
  return NextResponse.json(response, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control':
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=0',
      'CDN-Cache-Control': 'public, s-maxage=3600',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=3600',
      'X-Runtime': 'edge',
    },
  });
}

/**
 * 🔧 OPTIONS /api/web-vitals
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
