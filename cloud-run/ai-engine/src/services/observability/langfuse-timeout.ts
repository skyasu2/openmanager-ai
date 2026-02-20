import { logger } from '../../lib/logger';
import type { TimeoutEventContext, TimeoutSpanHandle } from './langfuse-contracts';
import { getLangfuse } from './langfuse-client';
import { shouldTrackLangfuseEvent } from './langfuse-usage';

export function logTimeoutEvent(
  type: 'warning' | 'error',
  context: TimeoutEventContext
): void {
  if (!shouldTrackLangfuseEvent(context.sessionId)) {
    return;
  }

  const langfuse = getLangfuse();

  langfuse.trace({
    name: `timeout_${type}`,
    sessionId: context.sessionId,
    metadata: {
      operation: context.operation,
      elapsed: context.elapsed,
      threshold: context.threshold,
      ratio: Math.round((context.elapsed / context.threshold) * 100) / 100,
      level: type === 'error' ? 'ERROR' : 'WARNING',
    },
    input: JSON.stringify({
      operation: context.operation,
      elapsed: `${context.elapsed}ms`,
      threshold: `${context.threshold}ms`,
    }),
  });

  const message = `[Langfuse] Timeout ${type}: ${context.operation} (${context.elapsed}ms / ${context.threshold}ms threshold)`;
  if (type === 'error') {
    logger.error(message);
  } else {
    logger.warn(message);
  }
}

export function createTimeoutSpan(
  traceId: string,
  operation: string,
  timeout: number
): TimeoutSpanHandle {
  if (!shouldTrackLangfuseEvent(traceId)) {
    return {
      complete: () => {},
    };
  }

  const langfuse = getLangfuse();
  const startTime = Date.now();

  const trace = langfuse.trace({
    name: `timeout_monitor_${operation}`,
    sessionId: traceId,
    metadata: {
      timeout,
      operation,
      startTime: new Date().toISOString(),
    },
  });

  return {
    complete: (success: boolean, elapsed: number) => {
      const didTimeout = elapsed >= timeout;
      const utilizationPercent = Math.round((elapsed / timeout) * 100);

      trace.update({
        output: JSON.stringify({
          success,
          elapsed: `${elapsed}ms`,
          didTimeout,
          utilizationPercent: `${utilizationPercent}%`,
        }),
        metadata: {
          success,
          elapsed,
          didTimeout,
          utilizationPercent,
          endTime: new Date().toISOString(),
          actualDuration: Date.now() - startTime,
        },
      });

      if (didTimeout) {
        trace.score({
          name: 'timeout-occurred',
          value: 0,
        });
      } else if (success) {
        trace.score({
          name: 'within-timeout',
          value: 1,
        });
      }
    },
  };
}
