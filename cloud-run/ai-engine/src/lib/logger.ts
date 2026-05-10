/**
 * GCP Cloud Logging Optimized Logger
 *
 * Pino-based structured logging for Google Cloud Run.
 * Production: stdout structured logging config for Cloud Run
 *   - severity mapping, insertId ordering
 *   - stack_trace → Error Reporting, OTel trace field mapping
 * Development: 기본 pino stdout 출력
 *
 * @see https://cloud.google.com/logging/docs/structured-logging
 */

import pino from 'pino';
import { version as APP_VERSION } from '../../package.json';

const SERVICE_CONTEXT = {
  service: 'ai-engine',
  version: APP_VERSION,
};

const GCP_SEVERITY_BY_PINO_LEVEL: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

let insertIdCounter = 0;

function nextInsertId(): string {
  insertIdCounter = (insertIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${process.pid.toString(36)}-${insertIdCounter.toString(36)}`;
}

function cloudLoggingTimestamp(): string {
  const now = Date.now();
  const seconds = Math.floor(now / 1000);
  const nanos = (now % 1000) * 1_000_000;
  return `,"timestamp":{"seconds":${seconds},"nanos":${nanos}}`;
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const property = value[key];
  return typeof property === 'string' && property.length > 0 ? property : undefined;
}

function extractStackTrace(value: unknown): string | undefined {
  if (value instanceof Error) {
    return value.stack;
  }

  if (typeof value === 'object' && value !== null) {
    const stack = (value as { stack?: unknown }).stack;
    return typeof stack === 'string' && stack.length > 0 ? stack : undefined;
  }

  return undefined;
}

function formatCloudLoggingRecord(
  logObject: Record<string, unknown>
): Record<string, unknown> {
  const formatted = { ...logObject };

  const traceId =
    getStringProperty(formatted, 'trace_id') ?? getStringProperty(formatted, 'traceId');
  const spanId =
    getStringProperty(formatted, 'span_id') ?? getStringProperty(formatted, 'spanId');
  const traceFlags =
    getStringProperty(formatted, 'trace_flags') ??
    getStringProperty(formatted, 'traceFlags');
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  if (traceId) {
    formatted['logging.googleapis.com/trace'] = projectId
      ? `projects/${projectId}/traces/${traceId}`
      : traceId;
    delete formatted.trace_id;
    delete formatted.traceId;
  }

  if (spanId) {
    formatted['logging.googleapis.com/spanId'] = spanId;
    delete formatted.span_id;
    delete formatted.spanId;
  }

  if (traceFlags) {
    formatted['logging.googleapis.com/trace_sampled'] =
      traceFlags === '01' ||
      traceFlags === '1' ||
      traceFlags.toLowerCase() === 'true';
    delete formatted.trace_flags;
    delete formatted.traceFlags;
  }

  const stackTrace =
    extractStackTrace(formatted.err) ?? extractStackTrace(formatted.error);
  if (stackTrace && typeof formatted.stack_trace !== 'string') {
    formatted.stack_trace = stackTrace;
  }

  return formatted;
}

export function createCloudRunPinoOptions(logLevel: string): pino.LoggerOptions {
  return {
    level: logLevel,
    messageKey: 'message',
    base: {
      service: SERVICE_CONTEXT.service,
      version: SERVICE_CONTEXT.version,
      serviceContext: SERVICE_CONTEXT,
    },
    timestamp: cloudLoggingTimestamp,
    mixin: () => ({
      'logging.googleapis.com/insertId': nextInsertId(),
    }),
    formatters: {
      level(label, number) {
        return {
          severity: GCP_SEVERITY_BY_PINO_LEVEL[label] || 'DEFAULT',
          level: number,
        };
      },
      log: formatCloudLoggingRecord,
    },
  };
}

/**
 * Create GCP-optimized Pino logger
 */
function createLogger(): pino.Logger {
  const isVitestProcess =
    process.argv.some((arg) => arg.includes('vitest')) ||
    process.env.npm_lifecycle_script?.includes('vitest') ||
    process.env.npm_lifecycle_event === 'test';
  const isTest =
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    Boolean(process.env.VITEST_WORKER_ID) ||
    isVitestProcess;
  const isDev = process.env.NODE_ENV === 'development';
  const useLocalLogger = isDev || isTest;
  // Free Tier 최적화: Production에서 'warn' 레벨 사용
  // GCP Cloud Logging 비용 50%+ 절감 (info 로그 생략)
  const logLevel =
    process.env.LOG_LEVEL || (useLocalLogger ? (isTest ? 'error' : 'debug') : 'warn');

  if (!useLocalLogger) {
    return pino(createCloudRunPinoOptions(logLevel));
  }

  if (isTest) {
    return pino({
      enabled: false,
      level: 'silent',
      base: {
        service: SERVICE_CONTEXT.service,
        version: SERVICE_CONTEXT.version,
      },
    });
  }

  // Development: simple stdout output
  return pino({
    level: logLevel,
    base: {
      service: SERVICE_CONTEXT.service,
      version: SERVICE_CONTEXT.version,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino/file',
      options: { destination: 1 },
    },
  });
}

const pinoLogger = createLogger();

/**
 * Console-compatible logger wrapper
 *
 * Pino의 시그니처는 (obj, msg) | (msg) 형태이지만,
 * console.warn/error('msg', extra) 패턴을 지원하기 위해 래핑합니다.
 * 두 번째 이후 인자는 structured context로 변환됩니다.
 */
function createWrappedLogger(pino: pino.Logger): WrappedLogger {
  function wrapMethod(method: 'warn' | 'error' | 'info' | 'debug' | 'fatal') {
    return (msgOrObj: unknown, ...args: unknown[]) => {
      // Pino 표준 호출: logger.error({ err, url }, 'msg')
      if (typeof msgOrObj === 'object' && msgOrObj !== null && args.length > 0 && typeof args[0] === 'string') {
        return pino[method](msgOrObj as Record<string, unknown>, args[0]);
      }

      // console-style 호출: logger.error('msg', error)
      if (typeof msgOrObj === 'string' && args.length > 0) {
        const extra = args[0];
        if (extra instanceof Error) {
          return pino[method]({ err: extra }, msgOrObj);
        }
        return pino[method]({ extra }, msgOrObj);
      }

      // 단순 문자열: logger.error('msg')
      if (typeof msgOrObj === 'string') {
        return pino[method](msgOrObj);
      }

      // 객체만: logger.error({ err })
      return pino[method](msgOrObj as Record<string, unknown>);
    };
  }

  return {
    warn: wrapMethod('warn'),
    error: wrapMethod('error'),
    info: wrapMethod('info'),
    debug: wrapMethod('debug'),
    fatal: wrapMethod('fatal'),
    child: (bindings: Record<string, unknown>) => createWrappedLogger(pino.child(bindings)),
    get level() { return pino.level; },
    set level(val: string) { pino.level = val; },
  };
}

type LogMethod = (msgOrObj: unknown, ...args: unknown[]) => void;

type WrappedLogger = {
  warn: LogMethod;
  error: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  fatal: LogMethod;
  child: (bindings: Record<string, unknown>) => WrappedLogger;
  level: string;
};

export const logger: WrappedLogger = createWrappedLogger(pinoLogger);

/**
 * Create a child logger with additional context
 */
export function createChildLogger(
  context: Record<string, string | number | boolean>
): WrappedLogger {
  return createWrappedLogger(pinoLogger.child(context));
}

/**
 * Request-scoped logger factory
 */
export function createRequestLogger(requestId: string, path: string): WrappedLogger {
  return createWrappedLogger(pinoLogger.child({
    requestId,
    path,
  }));
}

export type Logger = WrappedLogger;
