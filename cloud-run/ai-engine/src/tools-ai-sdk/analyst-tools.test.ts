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
      healthyCount: 3,
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
      details: { lowerThreshold: 0, upperThreshold: 100 },
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

import { detectAnomaliesAllServers } from './analyst-tools';

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
        expect(result.algorithmVersion).toBe('2.3.0');
        expect(result.decisionSource).toBe('threshold_scan+linear_projection');
        expect(result.confidenceBasis).toBe('status-thresholds:ssot,history:last6h');
        expect(result.riskForecast.model).toBe('lightweight_linear_projection_v1');
        expect(result._algorithm).toContain('Linear Projection');
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

    it('should count healthy/warning/critical servers correctly', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        const { healthyCount, warningCount, criticalCount, totalServers } = result.summary;

        // Total should equal sum of counts
        expect(healthyCount + warningCount + criticalCount).toBe(totalServers);

        // Based on mock data:
        // - 3 healthy: web-01, db-02, cache-01
        // - 1 warning: web-02
        // - 1 critical: db-01
        expect(healthyCount).toBe(3);
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
        expect(result).toHaveProperty('confidenceBasis');
        expect(result).toHaveProperty('riskForecast');
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
        expect(result.summary).toHaveProperty('healthyCount');
        expect(result.summary).toHaveProperty('warningCount');
        expect(result.summary).toHaveProperty('criticalCount');
      }
    });

    it('should include risk forecast metadata', async () => {
      const result = await detectAnomaliesAllServers.execute({ metricType: 'all' }, {} as never);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.riskForecast.horizonHours).toBe(1);
        expect(result.riskForecast.model).toBe('lightweight_linear_projection_v1');
        expect(Array.isArray(result.riskForecast.predictedBreaches)).toBe(true);
        expect(result.riskForecast.breachCount).toBe(result.riskForecast.predictedBreaches.length);
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
