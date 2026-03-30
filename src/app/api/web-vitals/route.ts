import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logging';

const metricNameSchema = z.enum(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']);
const metricRatingSchema = z.enum(['good', 'needs-improvement', 'poor']);

const webVitalMetricSchema = z.object({
  name: metricNameSchema,
  value: z.number().finite().nonnegative(),
  rating: metricRatingSchema,
  delta: z.number().finite(),
  id: z.string().min(1).max(128),
  navigationType: z.string().max(64).optional(),
});

const webVitalsPayloadSchema = z.object({
  url: z.string().min(1).max(256),
  hostname: z.string().min(1).max(128),
  appVersion: z.string().min(1).max(64),
  timestamp: z.number().int().positive(),
  sessionId: z.string().min(1).max(128),
  deviceType: z.enum(['mobile', 'desktop']),
  metrics: z.array(webVitalMetricSchema).min(1).max(5),
});

type WebVitalMetric = z.infer<typeof webVitalMetricSchema>;

function getScoreForRating(rating: WebVitalMetric['rating']): number {
  switch (rating) {
    case 'good':
      return 95;
    case 'needs-improvement':
      return 70;
    case 'poor':
      return 35;
  }
}

function getOverallRating(metrics: WebVitalMetric[]): WebVitalMetric['rating'] {
  if (metrics.some((metric) => metric.rating === 'poor')) return 'poor';
  if (metrics.some((metric) => metric.rating === 'needs-improvement')) {
    return 'needs-improvement';
  }
  return 'good';
}

function buildRecommendations(metrics: WebVitalMetric[]): string[] {
  const recommendations = new Set<string>();

  for (const metric of metrics) {
    if (metric.name === 'LCP' && metric.value > 2500) {
      recommendations.add('이미지 최적화 (WebP/AVIF 형식 사용)');
      recommendations.add('히어로 영역 리소스 preload와 캐시 전략 점검');
    }

    if (metric.name === 'CLS' && metric.value > 0.1) {
      recommendations.add('레이아웃 시프트 방지를 위한 이미지 크기 명시');
      recommendations.add('폰트 로딩 최적화 (font-display: swap)');
    }

    if (metric.name === 'INP' && metric.value > 200) {
      recommendations.add('JavaScript 실행 시간 최적화');
      recommendations.add('메인 스레드 작업 분산');
    }

    if (metric.name === 'FCP' && metric.value > 1800) {
      recommendations.add('초기 렌더 차단 리소스 축소');
    }

    if (metric.name === 'TTFB' && metric.value > 800) {
      recommendations.add('서버 응답 시간 및 캐시 전략 점검');
    }
  }

  if (recommendations.size === 0) {
    recommendations.add(
      '현재 Core Web Vitals는 양호합니다. 추세만 계속 모니터링하세요.'
    );
  }

  return Array.from(recommendations);
}

function analyzeWebVitals(metrics: WebVitalMetric[]) {
  const overall = getOverallRating(metrics);
  const score = Math.round(
    metrics.reduce((sum, metric) => sum + getScoreForRating(metric.rating), 0) /
      metrics.length
  );

  return {
    overall,
    score,
    insights: metrics.map((metric) => {
      const unit = metric.name === 'CLS' ? '' : 'ms';
      return `${metric.name}: ${metric.value}${unit} (${metric.rating})`;
    }),
    recommendations: buildRecommendations(metrics),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = webVitalsPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid web vitals payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const analysis = analyzeWebVitals(payload.metrics);

    logger.info('[web-vitals] field metrics received', {
      url: payload.url,
      hostname: payload.hostname,
      appVersion: payload.appVersion,
      deviceType: payload.deviceType,
      sessionId: payload.sessionId,
      metricCount: payload.metrics.length,
      overall: analysis.overall,
      score: analysis.score,
      metrics: payload.metrics.map((metric) => ({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        analysis,
      },
    });
  } catch (error) {
    logger.error('[web-vitals] failed to process request', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process web vitals payload',
      },
      { status: 500 }
    );
  }
}
