/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  getMsUntilNextServerDataSlot,
  SERVER_DATA_INTERVAL_MS,
  SERVER_DATA_MIN_REFETCH_MS,
  SERVER_DATA_REFETCH_BUFFER_MS,
} from './server-data-polling';

describe('getMsUntilNextServerDataSlot', () => {
  it('KST 기준 다음 10분 슬롯까지 남은 시간을 계산한다', () => {
    // UTC 03:03:15 => KST 12:03:15
    const now = new Date(Date.UTC(2026, 1, 20, 3, 3, 15, 0));
    const expected = 6 * 60 * 1000 + 45 * 1000 + SERVER_DATA_REFETCH_BUFFER_MS;

    expect(getMsUntilNextServerDataSlot(now)).toBe(expected);
  });

  it('정각 슬롯에서는 다음 10분 슬롯으로 계산한다', () => {
    // UTC 03:10:00 => KST 12:10:00
    const now = new Date(Date.UTC(2026, 1, 20, 3, 10, 0, 0));
    expect(getMsUntilNextServerDataSlot(now)).toBe(
      SERVER_DATA_INTERVAL_MS + SERVER_DATA_REFETCH_BUFFER_MS
    );
  });

  it('경계 직전 값은 최소 refetch 간격으로 보정한다', () => {
    // UTC 03:09:59.900 => KST 12:09:59.900
    const now = new Date(Date.UTC(2026, 1, 20, 3, 9, 59, 900));
    expect(getMsUntilNextServerDataSlot(now)).toBe(SERVER_DATA_MIN_REFETCH_MS);
  });
});
