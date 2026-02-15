import { describe, expect, it } from 'vitest';
import {
  generateChartPointsFromData,
  parseMetricsHistoryFromResponse,
} from './useServerMetrics';

describe('parseMetricsHistoryFromResponse', () => {
  it('parses standard data.history.data_points response', () => {
    const payload = {
      success: true,
      data: {
        history: {
          data_points: [
            {
              timestamp: '2026-02-13T00:00:00.000Z',
              metrics: {
                cpu_usage: 61,
                memory_usage: 52,
                disk_usage: 40,
                network_in: 20,
                network_out: 10,
                response_time: 123,
              },
            },
          ],
        },
      },
    };

    const parsed = parseMetricsHistoryFromResponse(payload);
    expect(parsed).toEqual([
      {
        timestamp: '2026-02-13T00:00:00.000Z',
        cpu: 61,
        memory: 52,
        disk: 40,
        network: 15,
        responseTime: 123,
        connections: 0,
      },
    ]);
  });

  it('returns null for legacy history.metrics format', () => {
    const payload = {
      success: true,
      history: {
        metrics: [
          {
            timestamp: '2026-02-13T01:00:00.000Z',
            cpu: 55,
            memory: 51,
            disk: 48,
            network: 44,
            responseTime: 110,
            connections: 90,
          },
        ],
      },
    };

    const parsed = parseMetricsHistoryFromResponse(payload);
    expect(parsed).toBeNull();
  });

  it('returns null for unsupported payloads', () => {
    expect(parseMetricsHistoryFromResponse({})).toBeNull();
    expect(parseMetricsHistoryFromResponse(null)).toBeNull();
    expect(
      parseMetricsHistoryFromResponse({ data: { history: {} } })
    ).toBeNull();
  });
});

describe('generateChartPointsFromData', () => {
  it('returns a centered point for single-value data', () => {
    expect(generateChartPointsFromData([42], 140)).toBe('0,70');
  });

  it('returns empty string for empty data', () => {
    expect(generateChartPointsFromData([])).toBe('');
  });
});
