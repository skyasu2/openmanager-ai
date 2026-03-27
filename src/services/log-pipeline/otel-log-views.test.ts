/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import type { OTelLogRecord } from '@/types/otel-metrics';
import {
  buildLogQL,
  groupOTelLogsIntoStreams,
  otelToAILog,
  otelToLokiEntry,
  otelToSyslogView,
} from './otel-log-views';

function makeLog(overrides: Partial<OTelLogRecord> = {}): OTelLogRecord {
  return {
    timeUnixNano: 1_707_984_000_000_000_000, // 2024-02-15T12:00:00Z in ns
    severityNumber: 9,
    severityText: 'INFO',
    body: 'Request handled successfully',
    attributes: {
      'log.source': 'nginx',
      'server.role': 'web',
      'deployment.environment.name': 'production',
      'cloud.availability_zone': 'ap-northeast-2a',
    },
    resource: 'web-nginx-kr-01',
    ...overrides,
  };
}

describe('otelToSyslogView', () => {
  it('converts OTel log to syslog view', () => {
    const result = otelToSyslogView(makeLog());
    expect(result.level).toBe('info');
    expect(result.message).toBe('Request handled successfully');
    expect(result.source).toBe('nginx');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults source to syslog when missing', () => {
    const log = makeLog({ attributes: {} });
    const result = otelToSyslogView(log);
    expect(result.source).toBe('syslog');
  });

  it('lowercases severity text', () => {
    const log = makeLog({ severityText: 'ERROR' });
    expect(otelToSyslogView(log).level).toBe('error');
  });
});

describe('otelToLokiEntry', () => {
  it('maps OTel severity to Loki level', () => {
    expect(
      otelToLokiEntry(makeLog({ severityText: 'INFO' })).labels.level
    ).toBe('info');
    expect(
      otelToLokiEntry(makeLog({ severityText: 'WARNING' })).labels.level
    ).toBe('warn');
    expect(
      otelToLokiEntry(makeLog({ severityText: 'CRITICAL' })).labels.level
    ).toBe('error');
    expect(
      otelToLokiEntry(makeLog({ severityText: 'FATAL' })).labels.level
    ).toBe('error');
    expect(
      otelToLokiEntry(makeLog({ severityText: 'TRACE' })).labels.level
    ).toBe('debug');
    expect(
      otelToLokiEntry(makeLog({ severityText: 'UNKNOWN' })).labels.level
    ).toBe('info');
  });

  it('sets correct labels from OTel attributes', () => {
    const result = otelToLokiEntry(makeLog());
    expect(result.labels.job).toBe('nginx');
    expect(result.labels.hostname).toBe('web-nginx-kr-01');
    expect(result.labels.environment).toBe('production');
    expect(result.labels.datacenter).toBe('ap-northeast-2a');
    expect(result.labels.server_type).toBe('web');
  });

  it('generates trace_id in structured metadata', () => {
    const result = otelToLokiEntry(makeLog());
    expect(result.structuredMetadata?.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('sets instance as resource:9100', () => {
    const result = otelToLokiEntry(makeLog());
    expect(result.structuredMetadata?.instance).toBe('web-nginx-kr-01:9100');
  });
});

describe('otelToAILog', () => {
  it('returns minimal log shape', () => {
    const result = otelToAILog(makeLog());
    expect(result).toEqual({
      level: 'info',
      source: 'nginx',
      message: 'Request handled successfully',
    });
  });
});

describe('groupOTelLogsIntoStreams', () => {
  it('groups logs by label combination', () => {
    const logs = [
      makeLog({ body: 'log 1' }),
      makeLog({ body: 'log 2' }),
      makeLog({ body: 'error log', severityText: 'ERROR', resource: 'db-01' }),
    ];

    const streams = groupOTelLogsIntoStreams(logs);
    // Same resource + same labels = 1 stream, different = another
    expect(streams.length).toBeGreaterThanOrEqual(2);

    const webStream = streams.find(
      (s) => s.stream.hostname === 'web-nginx-kr-01'
    );
    expect(webStream?.values).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(groupOTelLogsIntoStreams([])).toEqual([]);
  });
});

describe('buildLogQL', () => {
  it('builds query from label filters', () => {
    const result = buildLogQL({ hostname: 'web-01', level: 'error' });
    expect(result).toBe('{hostname="web-01", level="error"}');
  });

  it('returns empty selector for no filters', () => {
    expect(buildLogQL({})).toBe('{}');
  });

  it('ignores undefined and empty values', () => {
    const result = buildLogQL({
      hostname: 'web-01',
      level: undefined,
      job: '',
    });
    expect(result).toBe('{hostname="web-01"}');
  });
});
