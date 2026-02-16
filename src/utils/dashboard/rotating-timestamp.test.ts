import { describe, expect, it } from 'vitest';
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
  resolveRotatingTimestamp,
} from './rotating-timestamp';

describe('rotating-timestamp', () => {
  it('실시간 범위(36시간 이내) 데이터는 원본 날짜를 유지한다', () => {
    const anchorDate = new Date('2026-02-16T12:00:00+09:00');
    const source = '2026-02-15T22:30:00+09:00';

    const resolved = resolveRotatingTimestamp(source, { anchorDate });
    expect(resolved).not.toBeNull();
    expect(formatDashboardDateTime(resolved as Date)).toBe(
      '2026.02.15 22:30:00'
    );
  });

  it('오래된 순환 데이터는 접속 날짜로 정규화한다', () => {
    const anchorDate = new Date('2026-02-16T14:40:00+09:00');
    const source = '2026-01-03T09:15:20+09:00';

    const resolved = resolveRotatingTimestamp(source, { anchorDate });
    expect(resolved).not.toBeNull();
    expect(formatDashboardDateTime(resolved as Date)).toBe(
      '2026.02.16 09:15:20'
    );
  });

  it('정규화 결과가 기준 시각보다 과도하게 미래면 하루를 뺀다', () => {
    const anchorDate = new Date('2026-02-16T03:10:00+09:00');
    const source = '2026-01-03T23:50:00+09:00';

    const resolved = resolveRotatingTimestamp(source, {
      anchorDate,
      futureToleranceMinutes: 5,
    });
    expect(resolved).not.toBeNull();
    expect(formatDashboardDateTime(resolved as Date)).toBe(
      '2026.02.15 23:50:00'
    );
  });

  it('formatRotatingTimestamp는 YYYY.MM.DD HH:mm:ss 포맷을 반환한다', () => {
    const anchorDate = new Date('2026-02-16T18:00:00+09:00');
    const source = '2026-01-03T06:07:08+09:00';

    expect(formatRotatingTimestamp(source, { anchorDate })).toBe(
      '2026.02.16 06:07:08'
    );
  });

  it('잘못된 timestamp 문자열은 원문 그대로 반환한다', () => {
    expect(formatRotatingTimestamp('invalid-date')).toBe('invalid-date');
    expect(resolveRotatingTimestamp('invalid-date')).toBeNull();
  });
});
