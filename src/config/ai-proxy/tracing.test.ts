import { describe, expect, it } from 'vitest';

import {
  generateTraceId,
  generateTraceparent,
  normalizeTraceId,
  parseTraceparentTraceId,
  traceIdToUUID,
} from './tracing';

describe('ai-proxy tracing', () => {
  it('generates W3C-compatible 32-hex trace ids', () => {
    expect(generateTraceId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('normalizes UUID trace ids to 32-hex', () => {
    expect(normalizeTraceId('12345678-90AB-cdef-1234-567890ABCDEF')).toBe(
      '1234567890abcdef1234567890abcdef'
    );
  });

  it('rejects invalid or all-zero trace ids', () => {
    expect(normalizeTraceId('trace-123')).toBeNull();
    expect(normalizeTraceId('00000000000000000000000000000000')).toBeNull();
  });

  it('creates a valid traceparent with normalized trace id', () => {
    expect(
      generateTraceparent('12345678-90ab-cdef-1234-567890abcdef')
    ).toMatch(/^00-1234567890abcdef1234567890abcdef-[0-9a-f]{16}-01$/);
  });

  it('parses trace ids back from traceparent', () => {
    expect(
      parseTraceparentTraceId(
        '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01'
      )
    ).toBe('1234567890abcdef1234567890abcdef');
  });

  it('converts normalized trace ids back to UUID form when needed', () => {
    expect(traceIdToUUID('1234567890abcdef1234567890abcdef')).toBe(
      '12345678-90ab-cdef-1234-567890abcdef'
    );
  });
});
