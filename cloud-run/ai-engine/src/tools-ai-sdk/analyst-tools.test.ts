/**
 * Analyst Tools Tests
 *
 * Unit tests for analyst tools including detectAnomaliesAllServers.
 *
 * @version 1.0.0
 * @created 2026-01-25
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDetectAnomaly = vi.fn(() => ({
  isAnomaly: false,
  severity: 'low',
  confidence: 0.5,
  details: {
    lowerThreshold: 0,
    upperThreshold: 100,
    mean: 50,
    stdDev: 12,
    deviation: 0.1,
  },
}));

const mockDetectBaselineDrift = vi.fn(() => ({
  hasDrift: false,
  direction: 'stable',
  magnitude: 0,
  magnitudeSigma: 0,
  confidence: 0,
}));

const mockPredictEnhanced = vi.fn(() => ({
  trend: 'stable',
  prediction: 50,
  confidence: 0.8,
  currentStatus: 'online',
  thresholdBreach: {
    willBreachWarning: false,
    timeToWarning: null,
    willBreachCritical: false,
    timeToCritical: null,
    humanReadable: '',
  },
  recovery: {
    willRecover: false,
    timeToRecovery: null,
    humanReadable: null,
  },
  details: { predictedChangePercent: 0, currentValue: 50, slope: 0, intercept: 0, r2: 0, predictedChange: 0 },
}));

// Mock precomputed-state
const mockServers = [
  {
    id: 'web-nginx-dc1-01',
    name: 'Web Server 01',
    type: 'web',
    status: 'online',
    cpu: 45,
    memory: 62,
    disk: 55,
    network: 50,
    load1: 2.2,
    load5: 1.8,
    cpuCores: 4,
  },
  {
    id: 'web-nginx-dc1-02',
    name: 'Web Server 02',
    type: 'web',
    status: 'warning',
    cpu: 75, // >= 70 warning threshold
    memory: 82, // >= 75 warning threshold
    disk: 60,
    network: 60,
    load1: 3.4,
    load5: 2.9,
    cpuCores: 4,
  },
  {
    id: 'db-mysql-dc1-01',
    name: 'Database Primary',
    type: 'database',
    status: 'critical',
    cpu: 90, // >= 85 critical threshold
    memory: 95, // >= 90 critical threshold
    disk: 65,
    network: 70,
    load1: 7.2,
    load5: 6.1,
    cpuCores: 4,
  },
  {
    id: 'db-mysql-dc1-02',
    name: 'Database Replica',
    type: 'database',
    status: 'online',
    cpu: 35,
    memory: 55,
    disk: 60,
    network: 40,
    load1: 1.4,
    load5: 1.2,
    cpuCores: 4,
  },
  {
    id: 'cache-redis-dc1-01',
    name: 'Cache Server 01',
    type: 'cache',
    status: 'online',
    cpu: 30,
    memory: 40,
    disk: 20,
    network: 30,
    load1: 0.8,
    load5: 0.7,
    cpuCores: 2,
  },
];

vi.mock('../data/precomputed-state', () => ({
  getCurrentState: vi.fn(() => ({
    timestamp: new Date().toISOString(),
    servers: mockServers,
    systemHealth: {
      overall: 'warning',
      onlineCount: 3,
      warningCount: 1,
      criticalCount: 1,
    },
  })),
  getStateBySlot: vi.fn(() => ({
    timestamp: new Date().toISOString(),
    servers: mockServers,
  })),
}));

// Mock cache-layer
const mockGetAnalysis = vi.fn(
  (_type: string, _params: Record<string, unknown>, compute: () => Promise<unknown>) => compute()
);

vi.mock('../lib/cache-layer', () => ({
  getDataCache: vi.fn(() => ({
    getMetrics: vi.fn((_key: string, compute: () => Promise<unknown>) => compute()),
    getOrCompute: vi.fn((_type: string, _key: string, compute: () => Promise<unknown>) => compute()),
    getAnalysis: mockGetAnalysis,
  })),
}));


// Mock AI modules (not used in detectAnomaliesAllServers but imported)
vi.mock('../lib/ai/monitoring/SimpleAnomalyDetector', () => ({
  getAnomalyDetector: vi.fn(() => ({
    detectAnomaly: mockDetectAnomaly,
    detectBaselineDrift: mockDetectBaselineDrift,
  })),
}));

vi.mock('../lib/ai/monitoring/TrendPredictor', () => ({
  getTrendPredictor: vi.fn(() => ({
    predict: vi.fn(),
    predictEnhanced: mockPredictEnhanced,
  })),
}));

import { detectAnomalies, detectAnomaliesAllServers, predictTrends } from './analyst-tools';

// ============================================================================
// detectAnomaliesAllServers Tests
// ============================================================================

describe('detectAnomaliesAllServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAnomaly.mockClear();
    mockDetectBaselineDrift.mockClear();
    mockPredictEnhanced.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should return all servers summary with "all" metric type', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.totalServers).toBe(5);
        expect(result.summary.totalServers).toBe(5);
        expect(result.timestamp).toBeDefined();
        expect(result.algorithmVersion).toBe('2.5.0');
        expect(result.decisionSource).toBe('threshold_scan+linear_trend_scan');
        expect(result.analysisBasis).toBe('status-thresholds:ssot,history:last90min,horizon:30min');
        expect(result.evidenceContract).toMatchObject({
          mode: 'deterministic_evidence',
          toolRole: 'extract_metric_signals',
          llmRole: 'interpret_cause_impact_actions_from_evidence',
          signalStrengthMeaning: 'evidence_strength_not_incident_probability',
        });
        expect(result.evidenceContract.limitations).toContain('not_trained_ml');
        expect(result.risingTrendScan.method).toBe('linear_trend_scan');
        expect(result._algorithm).toContain('Rising Trend Scan');
      }
    });

    it('should detect warning anomalies based on SSOT thresholds', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        // web-nginx-dc1-02 has cpu=75 (>= 70 warning), memory=82 (>= 75 warning)
        const webServer02Anomalies = result.anomalies.filter(
          (a) => a.server_id === 'web-nginx-dc1-02'
        );
        expect(webServer02Anomalies.length).toBeGreaterThan(0);
        expect(webServer02Anomalies.every((a) => a.severity === 'warning' || a.severity === 'critical')).toBe(true);
      }
    });

    it('should detect critical anomalies based on SSOT thresholds', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        // db-mysql-dc1-01 has cpu=90 (>= 85 critical), memory=95 (>= 90 critical)
        const dbServer01Anomalies = result.anomalies.filter(
          (a) => a.server_id === 'db-mysql-dc1-01'
        );
        expect(dbServer01Anomalies.length).toBeGreaterThan(0);
        expect(dbServer01Anomalies.some((a) => a.severity === 'critical')).toBe(true);
      }
    });

    it('should count online/warning/critical servers correctly', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        const { onlineCount, warningCount, criticalCount, totalServers } = result.summary;

        // Total should equal sum of counts
        expect(onlineCount + warningCount + criticalCount).toBe(totalServers);

        // Based on mock data:
        // - 3 online: web-01, db-02, cache-01
        // - 1 warning: web-02
        // - 1 critical: db-01
        expect(onlineCount).toBe(3);
        expect(warningCount).toBe(1);
        expect(criticalCount).toBe(1);
      }
    });
  });

  describe('Metric Filtering', () => {
    it('should filter to CPU metrics only', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'cpu' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        // All anomalies should be CPU
        result.anomalies.forEach((a) => {
          expect(a.metric).toBe('Cpu');
        });
      }
    });

    it('should filter to memory metrics only', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'memory' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        result.anomalies.forEach((a) => {
          expect(a.metric).toBe('Memory');
        });
      }
    });

    it('should filter to disk metrics only', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'disk' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        result.anomalies.forEach((a) => {
          expect(a.metric).toBe('Disk');
        });
        // No disk anomalies in mock data (all < 80 warning threshold)
        expect(result.anomalies.length).toBe(0);
      }
    });

    it('should include network metrics in all-server anomaly scans', async () => {
      const externalServers = [
        {
          id: 'lb-haproxy-dc1-01',
          name: 'HAProxy LB 01',
          type: 'loadbalancer',
          status: 'critical' as const,
          cpu: 45,
          memory: 40,
          disk: 30,
          network: 86.3,
        },
      ];

      const result = await detectAnomaliesAllServers.execute(
        { metricType: 'all', externalServers },
        {} as never
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.anomalies).toEqual([
          expect.objectContaining({
            server_id: 'lb-haproxy-dc1-01',
            metric: 'Network',
            value: 86.3,
            severity: 'critical',
          }),
        ]);
        expect(result.affectedServers).toEqual(['lb-haproxy-dc1-01']);
      }
    });

    it('should filter to network metrics only', async () => {
      const externalServers = [
        {
          id: 'edge-01',
          name: 'Edge 01',
          type: 'loadbalancer',
          status: 'warning' as const,
          cpu: 91,
          memory: 40,
          disk: 30,
          network: 72,
        },
      ];

      const result = await detectAnomaliesAllServers.execute(
        { metricType: 'network', externalServers },
        {} as never
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.anomalies).toEqual([
          expect.objectContaining({
            metric: 'Network',
            severity: 'warning',
          }),
        ]);
      }
    });
  });

  describe('Affected Servers Tracking', () => {
    it('should track affected server IDs', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        // web-02 and db-01 have anomalies
        expect(result.affectedServers).toContain('web-nginx-dc1-02');
        expect(result.affectedServers).toContain('db-mysql-dc1-01');
        // Healthy servers should not be in affected list
        expect(result.affectedServers).not.toContain('web-nginx-dc1-01');
        expect(result.affectedServers).not.toContain('db-mysql-dc1-02');
        expect(result.affectedServers).not.toContain('cache-redis-dc1-01');
      }
    });

    it('should set hasAnomalies correctly', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hasAnomalies).toBe(true);
        expect(result.anomalyCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Caching Behavior', () => {
    it('should use cache.getAnalysis with correct type', async () => {
      await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(mockGetAnalysis).toHaveBeenCalledWith(
        'anomaly-all',
        { metricType: 'all' },
        expect.any(Function)
      );
    });

    it('should use different cache key for different metric types', async () => {
      await detectAnomaliesAllServers.execute({ metricType: 'cpu' }, {} as never);
      await detectAnomaliesAllServers.execute({ metricType: 'memory' }, {} as never);

      expect(mockGetAnalysis).toHaveBeenCalledWith(
        'anomaly-all',
        { metricType: 'cpu' },
        expect.any(Function)
      );
      expect(mockGetAnalysis).toHaveBeenCalledWith(
        'anomaly-all',
        { metricType: 'memory' },
        expect.any(Function)
      );
    });

    it('should separate cache params for different external server payloads', async () => {
      const externalServersA = [
        {
          id: 'external-a',
          name: 'External A',
          type: 'web',
          status: 'online' as const,
          cpu: 30,
          memory: 40,
          disk: 20,
          network: 10,
          history: { cpu: [20, 25, 30] },
        },
      ];
      const externalServersB = [
        {
          id: 'external-b',
          name: 'External B',
          type: 'web',
          status: 'warning' as const,
          cpu: 75,
          memory: 82,
          disk: 20,
          network: 10,
          history: { cpu: [55, 65, 75] },
        },
      ];

      await detectAnomaliesAllServers.execute(
        { metricType: 'cpu', externalServers: externalServersA },
        {} as never
      );
      await detectAnomaliesAllServers.execute(
        { metricType: 'cpu', externalServers: externalServersB },
        {} as never
      );

      const firstParams = mockGetAnalysis.mock.calls[0]?.[1] as
        | { metricType: string; externalCacheFingerprint?: string }
        | undefined;
      const secondParams = mockGetAnalysis.mock.calls[1]?.[1] as
        | { metricType: string; externalCacheFingerprint?: string }
        | undefined;

      expect(firstParams?.metricType).toBe('cpu');
      expect(secondParams?.metricType).toBe('cpu');
      expect(firstParams?.externalCacheFingerprint).toBeDefined();
      expect(secondParams?.externalCacheFingerprint).toBeDefined();
      expect(firstParams?.externalCacheFingerprint).not.toBe(
        secondParams?.externalCacheFingerprint
      );
    });
  });

  describe('Response Structure', () => {
    it('should include all required fields in response', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('totalServers');
        expect(result).toHaveProperty('anomalies');
        expect(result).toHaveProperty('affectedServers');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('hasAnomalies');
        expect(result).toHaveProperty('anomalyCount');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('algorithmVersion');
        expect(result).toHaveProperty('decisionSource');
        expect(result).toHaveProperty('analysisBasis');
        expect(result).toHaveProperty('evidenceContract');
        expect(result).toHaveProperty('risingTrendScan');
        expect(result).toHaveProperty('_algorithm');
      }
    });

    it('should include all required fields in anomaly items', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success && result.anomalies.length > 0) {
        const anomaly = result.anomalies[0];
        expect(anomaly).toHaveProperty('server_id');
        expect(anomaly).toHaveProperty('server_name');
        expect(anomaly).toHaveProperty('metric');
        expect(anomaly).toHaveProperty('value');
        expect(anomaly).toHaveProperty('severity');
      }
    });

    it('should include all required fields in summary', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.summary).toHaveProperty('totalServers');
        expect(result.summary).toHaveProperty('onlineCount');
        expect(result.summary).toHaveProperty('warningCount');
        expect(result.summary).toHaveProperty('criticalCount');
      }
    });

    it('should include risk forecast metadata', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.risingTrendScan.horizonHours).toBe(0.5);
        expect(result.risingTrendScan.method).toBe('linear_trend_scan');
        expect(Array.isArray(result.risingTrendScan.risingTrends)).toBe(true);
        expect(result.risingTrendScan.riskCount).toBe(result.risingTrendScan.risingTrends.length);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should return valid timestamp', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.timestamp).toBeDefined();
        expect(new Date(result.timestamp).getTime()).not.toBeNaN();
      }
    });

    it('should round values to one decimal place', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success && result.anomalies.length > 0) {
        result.anomalies.forEach((a) => {
          // Check value has at most 1 decimal place
          const decimals = (String(a.value).split('.')[1] || '').length;
          expect(decimals).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should capitalize metric names', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success && result.anomalies.length > 0) {
        result.anomalies.forEach((a) => {
          // First letter should be uppercase
          expect(a.metric[0]).toBe(a.metric[0].toUpperCase());
        });
      }
    });
  });
});

// ============================================================================
// External Data Source Tests
// ============================================================================

describe('detectAnomaliesAllServers with externalServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use externalServers when provided, ignoring precomputed data', async () => {
    const externalServers = [
      {
        id: 'real-server-01',
        name: 'Real Server 01',
        type: 'web',
        status: 'critical' as const,
        cpu: 92,
        memory: 85,
        disk: 40,
        network: 60,
      },
    ];

    const result = await detectAnomaliesAllServers.execute(
      { metricType: 'all', externalServers },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      // 외부 서버 1개만 스캔
      expect(result.totalServers).toBe(1);
      // cpu=92 >= critical threshold, memory=85 >= warning threshold → anomalies
      expect(result.hasAnomalies).toBe(true);
      expect(result.affectedServers).toContain('real-server-01');
      // precomputed mock 서버들은 포함되지 않아야 함
      expect(result.affectedServers).not.toContain('web-nginx-dc1-01');
    }
  });

  it('should use history from externalServers for rising trend scan', async () => {
    // cpu가 현재 65 (warning 미달)이지만 히스토리가 급상승 추세
    const risingHistory = [50, 52, 54, 56, 58, 60, 62, 64, 65]; // 9슬롯, 상승 추세
    const externalServers = [
      {
        id: 'trending-server',
        name: 'Trending Server',
        type: 'app',
        status: 'online' as const,
        cpu: 65,
        memory: 50,
        disk: 30,
        network: 20,
        history: { cpu: risingHistory },
      },
    ];

    const result = await detectAnomaliesAllServers.execute(
      { metricType: 'cpu', externalServers },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      // cpu 65는 threshold 미달 → 즉각 anomaly 없음
      expect(result.anomalies.length).toBe(0);
      // 하지만 risingTrendScan에서 상승 추세 감지 가능
      expect(result.risingTrendScan).toBeDefined();
      expect(Array.isArray(result.risingTrendScan.risingTrends)).toBe(true);
    }
  });

  it('should detect anomalies in externalServers with no history (current-value fallback)', async () => {
    const externalServers = [
      {
        id: 'no-history-server',
        name: 'No History Server',
        type: 'db',
        status: 'warning' as const,
        cpu: 82, // >= 80 warning threshold
        memory: 60,
        disk: 30,
        network: 10,
        // history 없음 → 현재값으로 폴백
      },
    ];

    const result = await detectAnomaliesAllServers.execute(
      { metricType: 'cpu', externalServers },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].server_id).toBe('no-history-server');
      expect(result.anomalies[0].severity).toBe('warning');
    }
  });

  it('should count server statuses from externalServers correctly', async () => {
    const externalServers = [
      { id: 's1', name: 'S1', type: 'web', status: 'online' as const, cpu: 30, memory: 40, disk: 20, network: 10 },
      { id: 's2', name: 'S2', type: 'web', status: 'critical' as const, cpu: 91, memory: 91, disk: 20, network: 10 },
      { id: 's3', name: 'S3', type: 'db', status: 'offline' as const, cpu: 0, memory: 0, disk: 0, network: 0 },
    ];

    const result = await detectAnomaliesAllServers.execute(
      { metricType: 'all', externalServers },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.totalServers).toBe(3);
      expect(result.summary.criticalCount).toBe(1);
      expect(result.summary.onlineCount).toBe(1);
    }
  });
});

// ============================================================================
// detectAnomalies Tests (single-server explainability)
// ============================================================================

describe('detectAnomalies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAnomaly.mockClear();
    mockDetectBaselineDrift.mockClear();
  });

  it('should include anomaly decision metadata for explainability', async () => {
    const result = await detectAnomalies.execute(
      { serverId: 'db-mysql-dc1-01', metricType: 'cpu' },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const cpu = result.results.cpu;
      expect(cpu).toBeDefined();
      expect(cpu.decisionSource).toBe('threshold');
      expect(cpu.analysisBasis).toContain('rule=threshold');
      expect(cpu.rationale).toBeInstanceOf(Array);
      expect(cpu.rationale.length).toBeGreaterThan(0);
      expect(result.evidenceContract).toMatchObject({
        mode: 'deterministic_evidence',
        signalStrengthMeaning: 'evidence_strength_not_incident_probability',
      });
      expect(result._algorithm).toBe('Threshold + Statistical + Enhanced Metrics');
      expect(result).toHaveProperty('summaryMessage');
    }
  });

  it('should tag threshold anomaly severity correctly when threshold is breached', async () => {
    const result = await detectAnomalies.execute(
      { serverId: 'db-mysql-dc1-01', metricType: 'cpu' },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const cpu = result.results.cpu;
      expect(cpu.isAnomaly).toBe(true);
      expect(cpu.thresholdExceeded).toBe(true);
      expect(cpu.severity).toBe('high');
    }
  });

  it('should use injected history for single-server anomaly analysis', async () => {
    await detectAnomalies.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'cpu',
        currentMetrics: { cpu: 88 },
        history: { cpu: [10, 20, 30, 40] },
      },
      {} as never
    );

    expect(mockDetectAnomaly).toHaveBeenCalled();
    expect(mockDetectAnomaly).toHaveBeenCalledWith(
      88,
      expect.arrayContaining([
        expect.objectContaining({ value: 10 }),
        expect.objectContaining({ value: 20 }),
        expect.objectContaining({ value: 30 }),
        expect.objectContaining({ value: 40 }),
      ])
    );
  });
});

describe('predictTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPredictEnhanced.mockClear();
  });

  it('should pass predictionHours to enhanced predictor as horizon ms', async () => {
    await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'cpu',
        predictionHours: 3,
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.any(Array),
      'cpu',
      3 * 60 * 60 * 1000
    );
  });

  it('should use injected history and current metrics for single-server trend analysis', async () => {
    await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'cpu',
        predictionHours: 2,
        currentMetrics: { cpu: 88 },
        history: { cpu: [15, 25, 35, 45] },
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 15 }),
        expect.objectContaining({ value: 25 }),
        expect.objectContaining({ value: 35 }),
        expect.objectContaining({ value: 45 }),
      ]),
      'cpu',
      2 * 60 * 60 * 1000
    );
  });

  it('should support network metric trend prediction with injected history', async () => {
    const result = await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'network',
        predictionHours: 1,
        currentMetrics: { network: 68 },
        history: { network: [20, 30, 45, 60, 68] },
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 20 }),
        expect.objectContaining({ value: 30 }),
        expect.objectContaining({ value: 45 }),
        expect.objectContaining({ value: 60 }),
        expect.objectContaining({ value: 68 }),
      ]),
      'network',
      60 * 60 * 1000
    );
    expect(result).toMatchObject({
      success: true,
      results: {
        network: expect.objectContaining({
          currentValue: expect.any(Number),
        }),
      },
    });
  });

  it('should include network when predicting all metrics', async () => {
    const result = await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'all',
        predictionHours: 1,
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.any(Array),
      'network',
      60 * 60 * 1000
    );
    expect(result).toMatchObject({
      success: true,
      results: {
        cpu: expect.any(Object),
        memory: expect.any(Object),
        disk: expect.any(Object),
        network: expect.any(Object),
      },
    });
  });

  it('should support load1 trend prediction with cpu-core thresholds', async () => {
    const result = await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'load1',
        predictionHours: 1,
        currentMetrics: { load1: 2.8, cpuCores: 4 },
        history: { load1: [1.1, 1.4, 1.8, 2.3, 2.8] },
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 1.1 }),
        expect.objectContaining({ value: 1.4 }),
        expect.objectContaining({ value: 1.8 }),
        expect.objectContaining({ value: 2.3 }),
        expect.objectContaining({ value: 2.8 }),
      ]),
      'load1',
      60 * 60 * 1000,
      { warning: 4, critical: 6, recovery: 2.8 }
    );
    expect(result).toMatchObject({
      success: true,
      results: {
        load1: expect.objectContaining({
          currentValue: 2.8,
        }),
      },
    });
  });

  it('should include load averages when predicting all metrics for cpu-core servers', async () => {
    const result = await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'all',
        predictionHours: 1,
      },
      {} as never
    );

    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.any(Array),
      'load1',
      60 * 60 * 1000,
      { warning: 4, critical: 6, recovery: 2.8 }
    );
    expect(mockPredictEnhanced).toHaveBeenCalledWith(
      expect.any(Array),
      'load5',
      60 * 60 * 1000,
      { warning: 4, critical: 6, recovery: 2.8 }
    );
    expect(result).toMatchObject({
      success: true,
      results: {
        cpu: expect.any(Object),
        memory: expect.any(Object),
        disk: expect.any(Object),
        network: expect.any(Object),
        load1: expect.any(Object),
        load5: expect.any(Object),
      },
    });
  });

  it('should expose lightweight evidence contract and trend decision metadata', async () => {
    const result = await predictTrends.execute(
      {
        serverId: 'web-nginx-dc1-01',
        metricType: 'cpu',
        predictionHours: 1,
      },
      {} as never
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decisionSource).toBe('linear_projection+threshold');
      expect(result.analysisBasis).toContain('last36slots-or-injected');
      expect(result.evidenceContract).toMatchObject({
        mode: 'deterministic_evidence',
        llmRole: 'interpret_cause_impact_actions_from_evidence',
      });
      expect(result.evidenceContract.limitations).toContain(
        'requires_llm_interpretation_for_causality'
      );
      expect(result.results.cpu).toMatchObject({
        decisionSource: 'linear_projection',
        analysisBasis: expect.stringContaining('metric:cpu'),
        rationale: expect.arrayContaining(['trend:stable']),
      });
    }
  });
});
