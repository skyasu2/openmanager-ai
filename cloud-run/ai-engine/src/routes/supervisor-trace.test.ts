import { describe, expect, it } from 'vitest';
import { extractTraceId } from './supervisor-trace';

describe('extractTraceId', () => {
  it('converts a valid traceparent header into 32-hex trace id', () => {
    expect(
      extractTraceId(
        '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01',
        undefined,
      ),
    ).toBe('1234567890abcdef1234567890abcdef');
  });

  it('normalizes legacy UUID trace id when traceparent is invalid', () => {
    expect(
      extractTraceId(
        'invalid-traceparent',
        '12345678-90ab-cdef-1234-567890abcdef',
      ),
    ).toBe('1234567890abcdef1234567890abcdef');
  });

  it('preserves opaque legacy trace ids when normalization is not possible', () => {
    expect(extractTraceId('invalid-traceparent', 'legacy-trace-id')).toBe(
      'legacy-trace-id',
    );
  });

  it('returns undefined when both trace headers are absent', () => {
    expect(extractTraceId(undefined, undefined)).toBeUndefined();
  });
});
