import { describe, expect, it } from 'vitest';

import { resolveHourlySourceSlotIndex } from './precomputed-state-core';

describe('resolveHourlySourceSlotIndex', () => {
  it('maps 6-slot hourly data directly to each 10-minute slot', () => {
    expect(
      Array.from({ length: 6 }, (_, slotInHour) =>
        resolveHourlySourceSlotIndex(slotInHour, 6)
      )
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('maps 60-slot hourly data to 10-minute boundaries', () => {
    expect(
      Array.from({ length: 6 }, (_, slotInHour) =>
        resolveHourlySourceSlotIndex(slotInHour, 60)
      )
    ).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('clamps empty or short sources safely', () => {
    expect(resolveHourlySourceSlotIndex(0, 0)).toBe(0);
    expect(resolveHourlySourceSlotIndex(5, 1)).toBe(0);
    expect(resolveHourlySourceSlotIndex(5, 3)).toBe(2);
  });
});
