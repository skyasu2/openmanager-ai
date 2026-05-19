import { describe, expect, it } from 'vitest';

import { ANALYST_INSTRUCTIONS } from './analyst';

describe('ANALYST_INSTRUCTIONS lightweight evidence boundary', () => {
  it('keeps anomaly and trend tools scoped as deterministic evidence for LLM interpretation', () => {
    expect(ANALYST_INSTRUCTIONS).toContain('경량 분석 경계');
    expect(ANALYST_INSTRUCTIONS).toContain('deterministic evidence layer');
    expect(ANALYST_INSTRUCTIONS).toContain('signalStrength');
    expect(ANALYST_INSTRUCTIONS).toContain('장애 발생 확률');
    expect(ANALYST_INSTRUCTIONS).toContain('제공되지 않은 메트릭·확률·시각');
  });
});
