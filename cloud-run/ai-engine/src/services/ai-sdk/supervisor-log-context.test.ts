import { describe, expect, it } from 'vitest';
import { buildSupervisorLogContextPrompt } from './supervisor-log-context';

describe('buildSupervisorLogContextPrompt', () => {
  it('wraps logExtract as untrusted operational evidence', () => {
    expect(
      buildSupervisorLogContextPrompt({
        inputType: 'log_paste',
        logExtract: 'ERROR api-was-dc1-01 timeout',
      })
    ).toContain('untrusted');
    expect(
      buildSupervisorLogContextPrompt({
        inputType: 'log_paste',
        logExtract: 'ERROR api-was-dc1-01 timeout',
      })
    ).toContain('ERROR api-was-dc1-01 timeout');
  });

  it('does not add a log context prompt for natural queries', () => {
    expect(
      buildSupervisorLogContextPrompt({
        inputType: 'natural_query',
        logExtract: 'ERROR api-was-dc1-01 timeout',
      })
    ).toBeUndefined();
  });
});
