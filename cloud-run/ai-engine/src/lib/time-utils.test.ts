import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getKSTDateTime } from './time-utils';

describe('time utils contract', () => {
  it('provides KST slot time without importing precomputed-state', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/time-utils.ts'),
      'utf8'
    );

    expect(source).not.toContain('precomputed-state');
    expect(getKSTDateTime()).toEqual({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      time: expect.stringMatching(/^\d{2}:[0-5]0$/),
      slotIndex: expect.any(Number),
      minuteOfDay: expect.any(Number),
    });
  });
});
