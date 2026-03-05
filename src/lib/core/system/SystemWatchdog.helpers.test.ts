import { describe, expect, it } from 'vitest';
import type {
  SystemMetrics,
  SystemStatus,
  WatchdogAlerts,
} from './SystemWatchdog.helpers';
import {
  calculateErrorRate,
  calculatePerformanceScore,
  calculateStabilityScore,
  createInitialSystemMetrics,
  detectMemoryLeak,
  getWatchdogRecommendation,
} from './SystemWatchdog.helpers';

describe('createInitialSystemMetrics', () => {
  it('should return metrics with all defaults', () => {
    const metrics = createInitialSystemMetrics();
    expect(metrics).toEqual({
      cpu: [],
      memory: [],
      errorRate: 0,
      restartCount: 0,
      performanceScore: 100,
      stabilityScore: 100,
    });
  });
});

describe('calculateErrorRate', () => {
  it('should return 0 when no processes exist', () => {
    expect(calculateErrorRate({})).toBe(0);
    expect(calculateErrorRate({ processes: [] })).toBe(0);
    expect(calculateErrorRate({ processes: undefined })).toBe(0);
  });

  it('should return 0 when all processes are healthy', () => {
    const status: SystemStatus = {
      processes: [
        { status: 'running', healthScore: 90 },
        { status: 'running', healthScore: 80 },
      ],
    };
    expect(calculateErrorRate(status)).toBe(0);
  });

  it('should return 50 when half the processes have errors', () => {
    const status: SystemStatus = {
      processes: [
        { status: 'running', healthScore: 90 },
        { status: 'error', healthScore: 80 },
        { status: 'running', healthScore: 30 },
        { status: 'running', healthScore: 75 },
      ],
    };
    expect(calculateErrorRate(status)).toBe(50);
  });

  it('should return 100 when all processes are in error', () => {
    const status: SystemStatus = {
      processes: [
        { status: 'error', healthScore: 10 },
        { status: 'error', healthScore: 20 },
      ],
    };
    expect(calculateErrorRate(status)).toBe(100);
  });
});

describe('calculatePerformanceScore', () => {
  it('should return 100 for perfect metrics', () => {
    const metrics = createInitialSystemMetrics();
    expect(calculatePerformanceScore(metrics)).toBe(100);
  });

  it('should deduct 20 for memory >500', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      memory: [{ timestamp: 1, value: 600 }],
    };
    expect(calculatePerformanceScore(metrics)).toBe(80);
  });

  it('should deduct 50 cumulatively for memory >1000', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      memory: [{ timestamp: 1, value: 1200 }],
    };
    expect(calculatePerformanceScore(metrics)).toBe(50);
  });

  it('should deduct 40 cumulatively for CPU >90', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      cpu: [{ timestamp: 1, value: 95 }],
    };
    expect(calculatePerformanceScore(metrics)).toBe(60);
  });

  it('should deduct 50 cumulatively for errorRate >25', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      errorRate: 30,
    };
    expect(calculatePerformanceScore(metrics)).toBe(50);
  });

  it('should clamp score to 0 when all penalties combined', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      memory: [{ timestamp: 1, value: 1500 }],
      cpu: [{ timestamp: 1, value: 95 }],
      errorRate: 30,
    };
    // -50 (memory) -40 (cpu) -50 (error) = -140 from 100 → clamped to 0
    expect(calculatePerformanceScore(metrics)).toBe(0);
  });
});

describe('detectMemoryLeak', () => {
  it('should return false with fewer than 10 data points', () => {
    const memory = Array.from({ length: 9 }, (_, i) => ({
      timestamp: i,
      value: i * 10,
    }));
    expect(detectMemoryLeak(memory)).toBe(false);
  });

  it('should return true when all 10 points are consistently increasing', () => {
    const memory = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: i * 10,
    }));
    expect(detectMemoryLeak(memory)).toBe(true);
  });

  it('should return false when values are flat', () => {
    const memory = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: 100,
    }));
    expect(detectMemoryLeak(memory)).toBe(false);
  });

  it('should return false when values are decreasing', () => {
    const memory = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: 100 - i * 5,
    }));
    expect(detectMemoryLeak(memory)).toBe(false);
  });

  it('should return false at exactly 80% threshold (needs >80%)', () => {
    // 10 points → 9 comparisons. 80% of 9 = 7.2 → need >7.2 i.e. 8 increases.
    // Exactly 80% means ~7.2 increases. We need exactly floor(9*0.8)=7 increases to be at threshold.
    // >80% means increasingCount > 9*0.8 = 7.2, so 7 increases should return false.
    // Build: 7 increases, 2 non-increases
    const memory = [
      { timestamp: 0, value: 100 },
      { timestamp: 1, value: 90 }, // decrease
      { timestamp: 2, value: 85 }, // decrease
      { timestamp: 3, value: 90 }, // increase (1)
      { timestamp: 4, value: 95 }, // increase (2)
      { timestamp: 5, value: 100 }, // increase (3)
      { timestamp: 6, value: 105 }, // increase (4)
      { timestamp: 7, value: 110 }, // increase (5)
      { timestamp: 8, value: 115 }, // increase (6)
      { timestamp: 9, value: 120 }, // increase (7)
    ];
    // 7 increases out of 9 comparisons → 7 > 9*0.8(=7.2)? No → false
    expect(detectMemoryLeak(memory)).toBe(false);
  });
});

describe('calculateStabilityScore', () => {
  it('should return 100 with no issues', () => {
    const metrics = createInitialSystemMetrics();
    expect(calculateStabilityScore(metrics, 0)).toBe(100);
  });

  it('should deduct 60 cumulatively for restartCount >10', () => {
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      restartCount: 15,
    };
    expect(calculateStabilityScore(metrics, 0)).toBe(40);
  });

  it('should apply combined penalties for memory leak and high alerts', () => {
    const leakingMemory = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: i * 10,
    }));
    const metrics: SystemMetrics = {
      ...createInitialSystemMetrics(),
      memory: leakingMemory,
      restartCount: 0,
    };
    // memory leak: -30, alerts(6 > 5): -25 → 100 - 30 - 25 = 45
    expect(calculateStabilityScore(metrics, 6)).toBe(45);
  });
});

describe('getWatchdogRecommendation', () => {
  const noAlerts: WatchdogAlerts = {
    memoryLeak: false,
    highErrorRate: false,
    performanceDegradation: false,
    frequentRestarts: false,
  };

  it('should return memory leak message', () => {
    expect(getWatchdogRecommendation({ ...noAlerts, memoryLeak: true })).toBe(
      '메모리 누수가 의심됩니다. 메모리 사용량을 모니터링하고 필요시 재시작을 고려하세요.'
    );
  });

  it('should return high error rate message', () => {
    expect(
      getWatchdogRecommendation({ ...noAlerts, highErrorRate: true })
    ).toBe('오류율이 높습니다. 로그를 확인하고 문제를 해결하세요.');
  });

  it('should return performance degradation message', () => {
    expect(
      getWatchdogRecommendation({ ...noAlerts, performanceDegradation: true })
    ).toBe(
      '성능이 저하되었습니다. 리소스 사용량을 확인하고 최적화를 고려하세요.'
    );
  });

  it('should return frequent restarts message', () => {
    expect(
      getWatchdogRecommendation({ ...noAlerts, frequentRestarts: true })
    ).toBe('프로세스가 자주 재시작됩니다. 안정성 문제를 조사하세요.');
  });

  it('should return healthy message when no alerts', () => {
    expect(getWatchdogRecommendation(noAlerts)).toBe(
      '시스템이 정상적으로 작동 중입니다.'
    );
  });
});
