import { describe, expect, it } from 'vitest';
import {
  normalizeNetworkUtilizationPercent,
  normalizeUtilizationPercent,
} from './metric-normalization';

describe('normalizeUtilizationPercent', () => {
  it('ratio(0~1)를 percent(0~100)로 변환한다', () => {
    expect(normalizeUtilizationPercent(0.456)).toBe(45.6);
    expect(normalizeUtilizationPercent(1)).toBe(100);
  });

  it('이미 percent 스케일 값은 그대로 유지한다', () => {
    expect(normalizeUtilizationPercent(80, '1')).toBe(80);
    expect(normalizeUtilizationPercent(12.34)).toBe(12.3);
  });

  it('유효 범위를 벗어나면 0~100으로 클램프한다', () => {
    expect(normalizeUtilizationPercent(-10)).toBe(0);
    expect(normalizeUtilizationPercent(120)).toBe(100);
  });
});

describe('normalizeNetworkUtilizationPercent', () => {
  it('ratio(0~1)를 percent(0~100)로 변환한다', () => {
    expect(normalizeNetworkUtilizationPercent(0.5, '1')).toBe(50);
  });

  it('legacy unit=By/s + percent-scale 값은 그대로 유지한다', () => {
    expect(normalizeNetworkUtilizationPercent(78, 'By/s')).toBe(78);
    expect(normalizeNetworkUtilizationPercent(95.6, 'By/s')).toBe(95.6);
  });

  it('unit=By/s + 실제 bytes/s 값을 1Gbps 기준 퍼센트로 변환한다', () => {
    expect(normalizeNetworkUtilizationPercent(62_500_000, 'By/s')).toBe(50);
    expect(normalizeNetworkUtilizationPercent(125_000_000, 'By/s')).toBe(100);
  });

  it('NaN/Infinity는 0으로 처리한다', () => {
    expect(normalizeNetworkUtilizationPercent(Number.NaN, 'By/s')).toBe(0);
    expect(
      normalizeNetworkUtilizationPercent(Number.POSITIVE_INFINITY, 'By/s')
    ).toBe(0);
  });
});
