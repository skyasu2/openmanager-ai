import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createCloudRunPinoOptions } from './logger';

function createMemoryLogger() {
  const chunks: string[] = [];
  const stream = {
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
  const logger = pino(createCloudRunPinoOptions('debug'), stream);

  return {
    logger,
    records: () => chunks.map((chunk) => JSON.parse(chunk)),
  };
}

describe('createCloudRunPinoOptions', () => {
  it('emits Cloud Logging structured fields without Google Cloud client deps', () => {
    const now = new Date('2026-05-10T12:34:56.789Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const { logger, records } = createMemoryLogger();

      logger.warn({ requestId: 'req-1' }, 'disk pressure');

      const [record] = records();
      expect(record).toMatchObject({
        severity: 'WARNING',
        level: 40,
        message: 'disk pressure',
        requestId: 'req-1',
        service: 'ai-engine',
        serviceContext: {
          service: 'ai-engine',
        },
        timestamp: {
          seconds: 1_778_416_496,
          nanos: 789_000_000,
        },
      });
      expect(record['logging.googleapis.com/insertId']).toMatch(/\w+-\w+-1/);
      expect(record).not.toHaveProperty('msg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps error stack traces and OpenTelemetry trace fields for Cloud Logging', () => {
    const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = 'openmanager-test';
    try {
      const { logger, records } = createMemoryLogger();
      const error = new Error('provider failed');

      logger.error(
        {
          err: error,
          trace_id: 'abc123',
          span_id: 'def456',
          trace_flags: '01',
        },
        'request failed'
      );

      const [record] = records();
      expect(record).toMatchObject({
        severity: 'ERROR',
        message: 'request failed',
        'logging.googleapis.com/trace': 'projects/openmanager-test/traces/abc123',
        'logging.googleapis.com/spanId': 'def456',
        'logging.googleapis.com/trace_sampled': true,
      });
      expect(record.stack_trace).toContain('Error: provider failed');
      expect(record).not.toHaveProperty('trace_id');
      expect(record).not.toHaveProperty('span_id');
      expect(record).not.toHaveProperty('trace_flags');
    } finally {
      if (previousProject === undefined) {
        delete process.env.GOOGLE_CLOUD_PROJECT;
      } else {
        process.env.GOOGLE_CLOUD_PROJECT = previousProject;
      }
    }
  });
});
