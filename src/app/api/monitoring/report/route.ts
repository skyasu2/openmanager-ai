/**
 * GET /api/monitoring/report
 *
 * MonitoringContext 파이프라인 결과를 Dashboard가 소비할 수 있는 REST API.
 * Health Score, Aggregated Metrics, Firing Alerts를 단일 응답으로 제공.
 *
 * @created 2026-02-11
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import {
  type MonitoringReportErrorCode,
  MonitoringReportErrorResponseSchema,
  MonitoringReportResponseSchema,
} from '@/schemas/api.monitoring-report.schema';
import { MonitoringContext } from '@/services/monitoring/MonitoringContext';
import { getErrorMessage } from '@/types/type-utils';

async function getHandler(_request: NextRequest) {
  const startTime = Date.now();

  try {
    const ctx = MonitoringContext.getInstance();
    const report = await ctx.analyze();
    const alertHistory = ctx.getAlertHistory();
    const processingTime = Date.now() - startTime;
    const responsePayload = {
      success: true as const,
      ...report,
      resolvedAlerts: alertHistory.resolved,
      metadata: {
        dataSource: 'hourly-data',
        processingTime,
      },
    };
    const validatedResponse =
      MonitoringReportResponseSchema.parse(responsePayload);

    return NextResponse.json(validatedResponse, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    logger.error('Monitoring report API error:', error);
    const message = getErrorMessage(error);
    const lowerMessage = message.toLowerCase();
    let code: MonitoringReportErrorCode = 'MONITORING_CONTEXT_ERROR';

    if (lowerMessage.includes('timeout')) {
      code = 'MONITORING_DATA_SOURCE_TIMEOUT';
    } else if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('schema')
    ) {
      code = 'MONITORING_RESPONSE_INVALID';
    }

    const errorResult = MonitoringReportErrorResponseSchema.safeParse({
      success: false as const,
      error: 'Monitoring report failed',
      message,
      code,
    });

    const errorPayload = errorResult.success
      ? errorResult.data
      : {
          success: false as const,
          error: 'Monitoring report failed',
          message,
          code,
        };

    return NextResponse.json(errorPayload, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
