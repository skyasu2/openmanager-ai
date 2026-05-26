import { describe, expect, it } from 'vitest';

import { BASE_AGENT_INSTRUCTIONS } from './common-instructions';

describe('BASE_AGENT_INSTRUCTIONS', () => {
  it('keeps technical units in English notation', () => {
    expect(BASE_AGENT_INSTRUCTIONS).toContain('기술 단위');
    expect(BASE_AGENT_INSTRUCTIONS).toContain('us/microseconds');
    expect(BASE_AGENT_INSTRUCTIONS).toContain('MiB');
  });
});
