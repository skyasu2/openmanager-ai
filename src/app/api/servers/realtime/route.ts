/**
 * GET /api/servers/realtime
 *
 * SSE 기반 실시간 서버 메트릭 스트리밍.
 * 30초 간격으로 MetricsProvider snapshot을 전송.
 * ?serverId=web-01 쿼리로 특정 서버 필터 가능.
 *
 * @created 2026-02-11
 */

import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logging';
import { MetricsProvider } from '@/services/metrics/MetricsProvider';

const POLL_INTERVAL_MS = 30_000;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5분 후 자동 종료

export async function GET(request: NextRequest) {
  const serverId = request.nextUrl.searchParams.get('serverId');
  const encoder = new TextEncoder();
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      sendEvent('connected', {
        timestamp: new Date().toISOString(),
        filter: serverId ?? 'all',
      });

      try {
        while (!aborted) {
          if (Date.now() - startTime > MAX_DURATION_MS) {
            sendEvent('timeout', { message: 'Stream max duration reached' });
            break;
          }

          const provider = MetricsProvider.getInstance();
          let servers = provider.getAllServerMetrics();

          if (serverId) {
            servers = servers.filter((s) => s.serverId === serverId);
          }

          sendEvent('metrics', {
            servers,
            count: servers.length,
            timestamp: new Date().toISOString(),
          });

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        logger.error('Realtime metrics stream error:', error);
        sendEvent('error', { message: String(error) });
      } finally {
        controller.close();
      }
    },

    cancel() {
      aborted = true;
      logger.info('[Realtime Stream] Client disconnected');
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
}
