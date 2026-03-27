import { describe, expect, it } from 'vitest';
import { formatMetricName, formatMetricValue } from './metric-formatters';

describe('formatMetricValue', () => {
  // 퍼센트 단위
  it('formats cpu as percentage', () => {
    expect(formatMetricValue('cpu', 75.5)).toBe('75.5%');
  });

  it('formats memory as percentage', () => {
    expect(formatMetricValue('memory', 82.34)).toBe('82.3%');
  });

  it('formats disk as percentage', () => {
    expect(formatMetricValue('disk_usage', 90)).toBe('90.0%');
  });

  it('formats network as percentage', () => {
    expect(formatMetricValue('network', 45.67)).toBe('45.7%');
  });

  // 바이트 단위
  it('formats bytes metric with /s suffix', () => {
    const result = formatMetricValue('bytes_received', 1048576);
    expect(result).toContain('/s');
    expect(result).toContain('MB');
  });

  it('formats disk_io as bytes (word-boundary "io" match)', () => {
    const result = formatMetricValue('disk_io', 1024);
    expect(result).toContain('/s');
  });

  it('formats io_read as bytes', () => {
    const result = formatMetricValue('io_read', 1024);
    expect(result).toContain('/s');
  });

  // 응답 시간
  it('formats time in ms', () => {
    expect(formatMetricValue('responseTime', 250)).toBe('250ms');
  });

  it('formats duration as time (word-boundary prevents false "io" match)', () => {
    expect(formatMetricValue('duration', 1500)).toBe('1.50s');
  });

  it('formats time >= 1000ms as seconds', () => {
    expect(formatMetricValue('response_time', 1500)).toBe('1.50s');
  });

  it('formats latency', () => {
    expect(formatMetricValue('latency', 42)).toBe('42ms');
  });

  // Fallback
  it('falls back to toLocaleString for unknown metrics', () => {
    expect(formatMetricValue('custom_count', 1234)).toBe(
      (1234).toLocaleString()
    );
  });
});

describe('formatMetricName', () => {
  it('maps known metrics', () => {
    expect(formatMetricName('cpu')).toBe('CPU');
    expect(formatMetricName('memory')).toBe('Memory');
    expect(formatMetricName('disk')).toBe('Disk');
    expect(formatMetricName('network')).toBe('Network I/O');
    expect(formatMetricName('responseTime')).toBe('Response Time');
    expect(formatMetricName('up')).toBe('Uptime');
  });

  it('capitalizes unknown metric name', () => {
    expect(formatMetricName('custom')).toBe('Custom');
  });
});
