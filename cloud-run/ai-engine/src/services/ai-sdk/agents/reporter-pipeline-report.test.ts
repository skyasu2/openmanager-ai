import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPredictEnhanced } = vi.hoisted(() => ({
  mockPredictEnhanced: vi.fn(() => ({
    prediction: 82.4,
    trend: 'increasing' as const,
    confidence: 0.74,
    thresholdBreach: {
      willBreachCritical: false,
      willBreachWarning: true,
      humanReadable: '20분 후 warning 임계값 도달 예상',
    },
  })),
}));

vi.mock('../../../config/status-thresholds', () => ({
  STATUS_THRESHOLDS: {
    cpu: { warning: 80, critical: 90, recovery: 65 },
    memory: { warning: 80, critical: 90, recovery: 75 },
    disk: { warning: 80, critical: 90, recovery: 75 },
    network: { warning: 70, critical: 85, recovery: 60 },
    responseTime: { warning: 2000, critical: 5000, recovery: 1500 },
  },
}));

vi.mock('../../../lib/ai/monitoring/TrendPredictor', () => ({
  getTrendPredictor: vi.fn(() => ({
    predictEnhanced: mockPredictEnhanced,
  })),
}));

import { generateInitialReport } from './reporter-pipeline-report';

const TEN_MINUTES_MS = 10 * 60 * 1000;

function createHistorySlots(
  baseTime: number,
  cpuValues: number[],
  serverId = 'api-server-01'
) {
  return cpuValues.map((cpu, index) => ({
    timestamp: new Date(baseTime + index * TEN_MINUTES_MS).toISOString(),
    data: {
      timestamp: new Date(baseTime + index * TEN_MINUTES_MS).toISOString(),
      servers: [{ id: serverId, cpu, memory: 54 }],
    },
  }));
}

describe('reporter-pipeline-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates predictions for no-incident warning servers', () => {
    const baseTime = Date.parse('2026-05-18T00:00:00.000Z');
    const report = generateInitialReport(
      {
        timestamp: new Date(baseTime + 3 * TEN_MINUTES_MS).toISOString(),
        servers: [
          {
            id: 'web-server-01',
            name: 'Web Server 01',
            type: 'web',
            status: 'online',
            cpu: 76,
            memory: 52,
            disk: 40,
            network: 30,
          },
        ],
      },
      createHistorySlots(baseTime, [70, 72, 74, 76], 'web-server-01')
    );

    expect(report?.affectedServers).toEqual([]);
    expect(report?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serverId: 'web-server-01',
          metric: 'cpu',
          currentValue: 76,
        }),
      ])
    );
    expect(report?.predictions).toEqual([
      expect.objectContaining({
        serverId: 'web-server-01',
        serverName: 'Web Server 01',
        metric: 'cpu',
      }),
    ]);
  });

  it('passes actual history slot timestamps to the trend predictor', () => {
    const baseTime = Date.parse('2026-05-18T00:00:00.000Z');
    const history = createHistorySlots(baseTime, [74, 82, 92]);

    const report = generateInitialReport(
      {
        timestamp: new Date(baseTime + 2 * TEN_MINUTES_MS).toISOString(),
        servers: [
          {
            id: 'api-server-01',
            name: 'API Server 01',
            type: 'application',
            status: 'critical',
            cpu: 92,
            memory: 62,
            disk: 40,
            network: 30,
          },
        ],
      },
      history
    );

    expect(report?.predictions?.length).toBeGreaterThan(0);
    const predictorInput = mockPredictEnhanced.mock.calls[0]?.[0] as Array<{
      timestamp: number;
      value: number;
    }>;
    expect(predictorInput.map((point) => point.timestamp)).toEqual(
      history.map((slot) => Date.parse(slot.timestamp))
    );
    expect(predictorInput.map((point) => point.value)).toEqual([74, 82, 92]);
  });

  it('calculates SLA uptime from twelve history slots', () => {
    const baseTime = Date.parse('2026-05-18T00:00:00.000Z');
    const report = generateInitialReport(
      {
        timestamp: new Date(baseTime + 11 * TEN_MINUTES_MS).toISOString(),
        servers: [
          {
            id: 'api-server-01',
            name: 'API Server 01',
            type: 'application',
            status: 'critical',
            cpu: 91,
            memory: 55,
            disk: 30,
            network: 20,
          },
        ],
      },
      createHistorySlots(baseTime, [91, 92, 70, 68, 66, 65, 64, 63, 62, 61, 60, 59])
    );

    expect(report?.sla?.actualUptime).toBe(83.3);
    expect(report?.timeline[0]?.timestamp).toBe(
      new Date(baseTime).toISOString()
    );
  });
});
