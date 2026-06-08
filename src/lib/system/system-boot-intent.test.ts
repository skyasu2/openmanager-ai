/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeSystemBootIntent,
  markSystemBootIntent,
} from './system-boot-intent';

describe('system boot intent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('marks and consumes a fresh boot intent once', () => {
    markSystemBootIntent(1_000);

    expect(consumeSystemBootIntent(1_100)).toBe(true);
    expect(consumeSystemBootIntent(1_200)).toBe(false);
  });

  it('ignores stale boot intents', () => {
    markSystemBootIntent(1_000);

    expect(consumeSystemBootIntent(32_000)).toBe(false);
  });
});
