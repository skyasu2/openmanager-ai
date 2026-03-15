import { describe, expect, it } from 'vitest';
import { extractTraceId } from './supervisor-trace';

describe('extractTraceId', () => {
  it('converts a valid traceparent header into dashed trace id', () => {
    expect(
      extractTraceId(
        '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01',
        undefined,
      ),
    ).toBe('12345678-90ab-cdef-1234-567890abcdef');
  });

  it('falls back to legacy trace id when traceparent is invalid', () => {
    expect(extractTraceId('invalid-traceparent', 'legacy-trace-id')).toBe(
      'legacy-trace-id',
    );
  });

  it('returns undefined when both trace headers are absent', () => {
    expect(extractTraceId(undefined, undefined)).toBeUndefined();
  });
});
