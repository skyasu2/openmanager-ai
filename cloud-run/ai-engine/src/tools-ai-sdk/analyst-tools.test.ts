/**
 * Analyst Tools Tests
 *
 * Unit tests for analyst tools including detectAnomaliesAllServers.
 *
 * @version 1.0.0
 * @created 2026-01-25
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    detectAnomaly: vi.fn(() => ({
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
    })),
    detectBaselineDrift: vi.fn(() => ({
      hasDrift: false,
      direction: 'stable',
      magnitude: 0,
      magnitudeSigma: 0,
      confidence: 0,
    })),
  })),
}));

vi.mock('../lib/ai/monitoring/TrendPredictor', () => ({
  getTrendPredictor: vi.fn(() => ({
    predict: vi.fn(),
    predictEnhanced: vi.fn(() => ({
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
      details: { predictedChangePercent: 0 },
    })),
  })),
}));

import { detectAnomalies, detectAnomaliesAllServers } from './analyst-tools';

// ============================================================================
// detectAnomaliesAllServers Tests
// ============================================================================

describe('detectAnomaliesAllServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
