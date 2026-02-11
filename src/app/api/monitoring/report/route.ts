/**
 * GET /api/monitoring/report
 *
 * MonitoringContext 파이프라인 결과를 Dashboard가 소비할 수 있는 REST API.
 * Health Score, Aggregated Metrics, Firing Alerts를 단일 응답으로 제공.
 *
 * @created 2026-02-11
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { MonitoringContext } from '@/services/monitoring/MonitoringContext';
import { getErrorMessage } from '@/types/type-utils';

export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    const ctx = MonitoringContext.getInstance();
    const report = ctx.analyze();
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        ...report,
        metadata: {
          dataSource: 'hourly-data',
          processingTime,
        },
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=0, s-maxage=30, stale-while-revalidate=0',
          'CDN-Cache-Control': 'public, s-maxage=30',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
        },
      }
    );
  } catch (error) {
    logger.error('Monitoring report API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Monitoring report failed',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
