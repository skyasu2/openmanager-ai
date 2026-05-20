import { describe, expect, it } from 'vitest';

import {
  CATEGORY_TARGET_RANGES,
  DEFAULT_TARGET_TOTAL_DOCS,
  HARD_MAX_TOTAL_DOCS,
  MAX_COMMAND_DOC_RATIO,
} from './rag-doc-policy';

describe('rag-doc-policy corpus expansion', () => {
  it('allows a bounded 80-doc KRL corpus after security and architecture expansion', () => {
    expect(DEFAULT_TARGET_TOTAL_DOCS).toBe(72);
    expect(HARD_MAX_TOTAL_DOCS).toBe(80);
    expect(MAX_COMMAND_DOC_RATIO).toBe(0.4);
    expect(CATEGORY_TARGET_RANGES.architecture).toEqual({ min: 2, max: 8 });
    expect(CATEGORY_TARGET_RANGES.security).toEqual({ min: 2, max: 5 });
    expect(CATEGORY_TARGET_RANGES.command).toEqual({ min: 18, max: 25 });
  });

  it('keeps the planned 67-doc post-seed distribution inside governance', () => {
    const planned = {
      total: 67,
      command: 25,
      architecture: 8,
      security: 5,
    };

    expect(planned.total).toBeLessThanOrEqual(DEFAULT_TARGET_TOTAL_DOCS);
    expect(planned.total).toBeLessThanOrEqual(HARD_MAX_TOTAL_DOCS);
    expect(planned.command / planned.total).toBeLessThanOrEqual(MAX_COMMAND_DOC_RATIO);
    expect(planned.architecture).toBeLessThanOrEqual(
      CATEGORY_TARGET_RANGES.architecture.max
    );
    expect(planned.security).toBeGreaterThanOrEqual(
      CATEGORY_TARGET_RANGES.security.min
    );
    expect(planned.security).toBeLessThanOrEqual(CATEGORY_TARGET_RANGES.security.max);
  });
});
