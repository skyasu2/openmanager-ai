import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './format-date';

describe('formatTime', () => {
  it('returns fallback for null', () => {
    expect(formatTime(null)).toBe('--:--:--');
  });

  it('returns fallback for undefined', () => {
    expect(formatTime(undefined)).toBe('--:--:--');
  });

  it('returns fallback for invalid date string', () => {
    expect(formatTime('not-a-date')).toBe('--:--:--');
  });

  it('formats valid Date object', () => {
    const date = new Date('2026-01-15T14:30:45');
    const result = formatTime(date);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('formats valid ISO string', () => {
    const result = formatTime('2026-01-15T14:30:45');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDate('invalid')).toBe('');
  });

  it('formats valid Date', () => {
    const date = new Date('2026-01-15');
    const result = formatDate(date);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDateTime', () => {
  it('returns "-" for null', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('returns "-" for invalid date', () => {
    expect(formatDateTime('invalid')).toBe('-');
  });

  it('formats valid Date', () => {
    const date = new Date('2026-01-15T14:30:00');
    const result = formatDateTime(date);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('-');
  });

  it('formats valid ISO string', () => {
    const result = formatDateTime('2026-06-15T10:00:00Z');
    expect(result).not.toBe('-');
  });
});
