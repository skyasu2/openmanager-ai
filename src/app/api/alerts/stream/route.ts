/**
 * GET /api/alerts/stream
 *
 * SSE 기반 실시간 알림 스트리밍.
 * 30초 간격으로 MonitoringContext에서 firing alerts를 평가하여 전송.
 *
 * @created 2026-02-11
 */

import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { MonitoringContext } from '@/services/monitoring/MonitoringContext';

const POLL_INTERVAL_MS = 30_000;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5분 후 자동 종료

export const GET = withAuth(async (_request: NextRequest) => {
  const encoder = new TextEncoder();
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      sendEvent('connected', { timestamp: new Date().toISOString() });

      try {
        while (!aborted) {
          if (Date.now() - startTime > MAX_DURATION_MS) {
            sendEvent('timeout', { message: 'Stream max duration reached' });
            break;
          }

          const ctx = MonitoringContext.getInstance();
          const report = await ctx.analyze();

          sendEvent('alert', {
            firingAlerts: report.firingAlerts,
            count: report.firingAlerts.length,
            criticalCount: report.firingAlerts.filter(
              (a) => a.severity === 'critical'
            ).length,
            timestamp: report.timestamp,
          });

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        logger.error('Alerts stream error:', error);
        sendEvent('error', { message: String(error) });
      } finally {
        controller.close();
      }
    },

    cancel() {
      aborted = true;
      logger.info('[Alerts Stream] Client disconnected');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
