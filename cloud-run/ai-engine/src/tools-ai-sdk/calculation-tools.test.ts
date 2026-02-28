/**
 * Calculation Tools Tests
 *
 * Unit tests for arithmetic expression, series statistics, and capacity projection tools.
 */

import { describe, expect, it } from 'vitest';

import {
  evaluateMathExpression,
  computeSeriesStats,
  estimateCapacityProjection,
} from './calculation-tools';

describe('evaluateMathExpression', () => {
  it('should evaluate basic arithmetic with precedence', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: '12 + 5*2', precision: 4 },
      { toolCallId: 'math-1', messages: [] }
    );
    expect(result.success).toBe(true);
    expect((result as { result: number }).result).toBe(22);
  });

  it('should evaluate function and parentheses', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: 'sqrt((5+4)*9) / 3', precision: 4 },
      { toolCallId: 'math-2', messages: [] }
    );
    expect(result.success).toBe(true);
    expect((result as { result: number }).result).toBe(3);
  });

  it('should support percent postfix notation', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: '25% + 75%', precision: 2 },
      { toolCallId: 'math-3', messages: [] }
    );
    expect(result.success).toBe(true);
    expect((result as { result: number }).result).toBe(1);
  });

  it('should convert standalone percent to decimal', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: '100%', precision: 4 },
      { toolCallId: 'math-pct-1', messages: [] }
    );
    expect(result.success).toBe(true);
    expect((result as { result: number }).result).toBe(1);
  });

  it('should handle percent in complex expression', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: '50% * 200', precision: 2 },
      { toolCallId: 'math-pct-2', messages: [] }
    );
    expect(result.success).toBe(true);
    expect((result as { result: number }).result).toBe(100);
  });

  it('should reject invalid expression safely', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: 'sqrt(-1)', precision: 4 },
      { toolCallId: 'math-4', messages: [] }
    );
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('sqrt는 음수');
  });

  it('should reject division by zero', async () => {
    const result = await evaluateMathExpression.execute!(
      { expression: '10 / 0', precision: 4 },
      { toolCallId: 'math-5', messages: [] }
    );
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('0으로 나눌 수 없습니다');
  });
});

describe('computeSeriesStats', () => {
  it('should calculate descriptive statistics', async () => {
    const result = await computeSeriesStats.execute!(
      { values: [1, 2, 3, 4, 5], precision: 2 },
      { toolCallId: 'stats-1', messages: [] }
    );
    expect(result.success).toBe(true);
    expect(result.count).toBe(5);
    expect(result.statistics.mean).toBe(3);
    expect(result.statistics.median).toBe(3);
    expect(result.statistics.min).toBe(1);
    expect(result.statistics.max).toBe(5);
    expect(result.statistics.variance).toBe(2);
  });

  it('should calculate even-count median', async () => {
    const result = await computeSeriesStats.execute!(
      { values: [10, 20, 30, 40], precision: 2 },
      { toolCallId: 'stats-2', messages: [] }
    );
    expect(result.success).toBe(true);
    expect(result.statistics.median).toBe(25);
    expect(result.statistics.range).toBe(30);
  });

  it('should fail for infinite values', async () => {
    const result = await computeSeriesStats.execute!(
      { values: [1, 2, Number.POSITIVE_INFINITY], precision: 2 },
      { toolCallId: 'stats-3', messages: [] }
    );
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('유한한 숫자');
  });
});

describe('estimateCapacityProjection', () => {
  it('should estimate saturation period when growth exceeds headroom', async () => {
    const result = await estimateCapacityProjection.execute!(
      {
        currentLoad: 60,
        targetCapacity: 100,
        growthRatePercent: 20,
        forecastPeriods: 12,
        headroomPercent: 20,
        precision: 2,
      },
      { toolCallId: 'cap-1', messages: [] }
    );
    expect(result.success).toBe(true);
    expect(result.saturationPeriod).toBe(2);
    expect(result.safeCapacity).toBe(80);
  });

  it('should return null saturation when capacity is not exceeded', async () => {
    const result = await estimateCapacityProjection.execute!(
      {
        currentLoad: 10,
        targetCapacity: 1000,
        growthRatePercent: 5,
        forecastPeriods: 3,
        headroomPercent: 20,
        precision: 2,
      },
      { toolCallId: 'cap-2', messages: [] }
    );
    expect(result.success).toBe(true);
    expect(result.saturationPeriod).toBe(null);
  });

  it('should fail for invalid params', async () => {
    const result = await estimateCapacityProjection.execute!(
      {
        currentLoad: -1,
        targetCapacity: 100,
        growthRatePercent: 10,
        forecastPeriods: 1,
        headroomPercent: 20,
        precision: 2,
      },
      { toolCallId: 'cap-3', messages: [] }
    );
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('TOOL_EXECUTION_FAILED');
  });
});
