import { describe, expect, it } from 'vitest';
import { REPORTER_INSTRUCTIONS } from './reporter';

describe('REPORTER_INSTRUCTIONS', () => {
  it('does not instruct Reporter to call Analyst-owned RCA tools directly', () => {
    expect(REPORTER_INSTRUCTIONS).not.toContain('correlateMetrics');
    expect(REPORTER_INSTRUCTIONS).not.toContain('findRootCause');
    expect(REPORTER_INSTRUCTIONS).toContain('Analyst Agent');
  });
});
