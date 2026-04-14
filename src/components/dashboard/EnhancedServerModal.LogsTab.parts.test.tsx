/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import {
  formatNsTimestamp,
  formatTimestamp,
} from './EnhancedServerModal.LogsTab.parts';

describe('EnhancedServerModal.LogsTab.parts', () => {
  it('잘못된 일반 타임스탬프를 현재 시각으로 위장하지 않아야 한다', () => {
    expect(formatTimestamp('not-a-real-date')).toBe('--:--:--');
  });

  it('잘못된 나노초 타임스탬프를 현재 시각으로 위장하지 않아야 한다', () => {
    expect(formatNsTimestamp('not-a-real-ns')).toBe('--:--:--.---');
  });
});
