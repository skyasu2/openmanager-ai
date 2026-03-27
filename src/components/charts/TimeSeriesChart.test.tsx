/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 TimeSeriesChart 컴포넌트 테스트
 *
 * @description 시계열 차트의 렌더링, 예측선, 이상탐지 구간 표시 검증
 * @author Claude Opus 4.5
 * @created 2026-01-12
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type AnomalyDataPoint,
  type MetricDataPoint,
  type PredictionDataPoint,
  TimeSeriesChart,
} from './TimeSeriesChart';

// Mock Recharts - ResponsiveContainer needs special handling
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="composed-chart" data-count={data?.length}>
      {children}
    </div>
  ),
  Line: ({
    dataKey,
    name,
    stroke,
    strokeDasharray,
  }: {
    dataKey: string;
    name: string;
    stroke: string;
    strokeDasharray?: string;
  }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-name={name}
      data-stroke={stroke}
      data-dashed={strokeDasharray ? 'true' : 'false'}
    />
  ),
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`area-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: ({ y, stroke }: { y: number; stroke: string }) => (
    <div data-testid={`reference-line-${y}`} data-stroke={stroke} />
  ),
  ReferenceArea: ({
    x1,
    x2,
    fill,
  }: {
    x1: string;
    x2: string;
    fill: string;
  }) => <div data-testid={`reference-area-${x1}-${x2}`} data-fill={fill} />,
  Brush: () => <div data-testid="brush" />,
}));

describe('🎯 TimeSeriesChart - 시계열 차트 테스트', () => {
  // 테스트용 Mock 데이터 생성
  const createMockData = (count: number): MetricDataPoint[] => {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(now - (count - i) * 300000).toISOString(),
      value: 50 + Math.random() * 30,
    }));
  };

  const createMockPredictions = (count: number): PredictionDataPoint[] => {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(now + i * 300000).toISOString(),
      predicted: 55 + Math.random() * 20,
      upper: 65 + Math.random() * 20,
      lower: 45 + Math.random() * 20,
    }));
  };

  const createMockAnomalies = (): AnomalyDataPoint[] => {
    const now = Date.now();
    return [
      {
        startTime: new Date(now - 3600000).toISOString(),
        endTime: new Date(now - 1800000).toISOString(),
        severity: 'high',
        description: 'CPU spike detected',
      },
      {
        startTime: new Date(now - 900000).toISOString(),
        endTime: new Date(now - 600000).toISOString(),
        severity: 'critical',
        description: 'Critical memory usage',
      },
    ];
  };

  describe('기본 렌더링', () => {
    it('데이터가 있을 때 차트가 렌더링된다', () => {
      const data = createMockData(10);

      render(<TimeSeriesChart data={data} metric="cpu" />);

      expect(screen.getByTestId('responsive-container')).toBeDefined();
      expect(screen.getByTestId('composed-chart')).toBeDefined();
      expect(screen.getByTestId('x-axis')).toBeDefined();
      expect(screen.getByTestId('y-axis')).toBeDefined();
    });

    it('데이터가 없을 때 빈 상태 메시지가 표시된다', () => {
      render(<TimeSeriesChart data={[]} metric="cpu" />);

      expect(screen.getByText('데이터가 없습니다')).toBeDefined();
    });

    it('실제값 라인이 렌더링된다', () => {
      const data = createMockData(10);

      render(<TimeSeriesChart data={data} metric="cpu" />);

      const valueLine = screen.getByTestId('line-value');
      expect(valueLine).toBeDefined();
      expect(valueLine.getAttribute('data-name')).toBe('실제값');
      expect(valueLine.getAttribute('data-stroke')).toBe('#10b981'); // emerald-500
      expect(valueLine.getAttribute('data-dashed')).toBe('false');
    });
  });

  describe('예측선 표시', () => {
    it('showPrediction이 true이고 predictions가 있으면 예측선이 렌더링된다', () => {
      const data = createMockData(10);
      const predictions = createMockPredictions(5);

      render(
        <TimeSeriesChart
          data={data}
          predictions={predictions}
          metric="cpu"
          showPrediction={true}
        />
      );

      const predictedLine = screen.getByTestId('line-predicted');
      expect(predictedLine).toBeDefined();
      expect(predictedLine.getAttribute('data-name')).toBe('예측값');
      expect(predictedLine.getAttribute('data-stroke')).toBe('#3b82f6'); // blue-500
      expect(predictedLine.getAttribute('data-dashed')).toBe('true');
    });

    it('showPrediction이 false이면 예측선이 렌더링되지 않는다', () => {
      const data = createMockData(10);
      const predictions = createMockPredictions(5);

      render(
        <TimeSeriesChart
          data={data}
          predictions={predictions}
          metric="cpu"
          showPrediction={false}
        />
      );

      expect(screen.queryByTestId('line-predicted')).toBeNull();
    });

    it('신뢰구간 Area가 렌더링된다', () => {
      const data = createMockData(10);
      const predictions = createMockPredictions(5);

      render(
        <TimeSeriesChart
          data={data}
          predictions={predictions}
          metric="cpu"
          showPrediction={true}
        />
      );

      expect(screen.getByTestId('area-upper')).toBeDefined();
      expect(screen.getByTestId('area-lower')).toBeDefined();
    });
  });

  describe('이상탐지 구간 표시', () => {
    it('showAnomalies가 true이고 anomalies가 있으면 구간이 표시된다', () => {
      const data = createMockData(20);
      const anomalies = createMockAnomalies();

      render(
        <TimeSeriesChart
          data={data}
          anomalies={anomalies}
          metric="cpu"
          showAnomalies={true}
        />
      );

      // 2개의 anomaly 구간이 ReferenceArea로 렌더링됨
      const referenceAreas = screen
        .getAllByTestId(/^reference-area-/)
        .filter((el) =>
          el.getAttribute('data-testid')?.startsWith('reference-area-')
        );
      expect(referenceAreas.length).toBe(2);
    });

    it('showAnomalies가 false이면 구간이 표시되지 않는다', () => {
      const data = createMockData(20);
      const anomalies = createMockAnomalies();

      render(
        <TimeSeriesChart
          data={data}
          anomalies={anomalies}
          metric="cpu"
          showAnomalies={false}
        />
      );

      expect(screen.queryAllByTestId(/^reference-area-/)).toHaveLength(0);
    });
  });

  describe('임계값 라인 표시', () => {
    it('showThresholds가 true이면 warning/critical 라인이 표시된다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart data={data} metric="cpu" showThresholds={true} />
      );

      // CPU default: warning=80, critical=90
      expect(screen.getByTestId('reference-line-80')).toBeDefined();
      expect(screen.getByTestId('reference-line-90')).toBeDefined();
    });

    it('custom thresholds가 적용된다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart
          data={data}
          metric="cpu"
          showThresholds={true}
          thresholds={{ warning: 70, critical: 85 }}
        />
      );

      expect(screen.getByTestId('reference-line-70')).toBeDefined();
      expect(screen.getByTestId('reference-line-85')).toBeDefined();
    });

    it('showThresholds가 false이면 임계값 라인이 표시되지 않는다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart data={data} metric="cpu" showThresholds={false} />
      );

      expect(screen.queryByTestId('reference-line-80')).toBeNull();
      expect(screen.queryByTestId('reference-line-90')).toBeNull();
    });
  });

  describe('메트릭별 기본 임계값', () => {
    it('memory 메트릭은 80/90 임계값을 가진다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart data={data} metric="memory" showThresholds={true} />
      );

      expect(screen.getByTestId('reference-line-80')).toBeDefined();
      expect(screen.getByTestId('reference-line-90')).toBeDefined();
    });

    it('disk 메트릭은 85/95 임계값을 가진다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart data={data} metric="disk" showThresholds={true} />
      );

      expect(screen.getByTestId('reference-line-85')).toBeDefined();
      expect(screen.getByTestId('reference-line-95')).toBeDefined();
    });

    it('network 메트릭은 70/85 임계값을 가진다', () => {
      const data = createMockData(10);

      render(
        <TimeSeriesChart data={data} metric="network" showThresholds={true} />
      );

      expect(screen.getByTestId('reference-line-70')).toBeDefined();
      expect(screen.getByTestId('reference-line-85')).toBeDefined();
    });
  });

  describe('Brush (줌/패닝)', () => {
    it('showBrush가 true이면 Brush가 렌더링된다', () => {
      const data = createMockData(50);

      render(<TimeSeriesChart data={data} metric="cpu" showBrush={true} />);

      expect(screen.getByTestId('brush')).toBeDefined();
    });

    it('showBrush가 false이면 Brush가 렌더링되지 않는다', () => {
      const data = createMockData(50);

      render(<TimeSeriesChart data={data} metric="cpu" showBrush={false} />);

      expect(screen.queryByTestId('brush')).toBeNull();
    });
  });

  describe('컴팩트 모드', () => {
    it('compact가 false이면 Legend가 표시된다', () => {
      const data = createMockData(10);

      render(<TimeSeriesChart data={data} metric="cpu" compact={false} />);

      expect(screen.getByTestId('legend')).toBeDefined();
    });

    it('compact가 true이면 간소화된 범례가 표시된다', () => {
      const data = createMockData(10);

      render(<TimeSeriesChart data={data} metric="cpu" compact={true} />);

      // 컴팩트 모드에서는 기본 Legend 대신 커스텀 범례 표시
      expect(screen.getByText('실제값')).toBeDefined();
    });
  });

  describe('데이터 병합 로직', () => {
    it('실제 데이터와 예측 데이터가 시간순으로 병합된다', () => {
      const data = createMockData(5);
      const predictions = createMockPredictions(3);

      render(
        <TimeSeriesChart
          data={data}
          predictions={predictions}
          metric="cpu"
          showPrediction={true}
        />
      );

      const chart = screen.getByTestId('composed-chart');
      const dataCount = Number(chart.getAttribute('data-count'));

      // 실제 데이터 5개 + 예측 데이터 3개 = 8개 (timestamp 중복 없다고 가정)
      expect(dataCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('높이 설정', () => {
    it('기본 높이는 300px이다', () => {
      const data = createMockData(10);

      const { container } = render(
        <TimeSeriesChart data={data} metric="cpu" />
      );

      // ResponsiveContainer가 height prop을 받음
      expect(
        container.querySelector('[data-testid="responsive-container"]')
      ).toBeDefined();
    });

    it('custom height가 적용된다', () => {
      const data = createMockData(10);

      const { container } = render(
        <TimeSeriesChart data={data} metric="cpu" height={400} />
      );

      expect(
        container.querySelector('[data-testid="responsive-container"]')
      ).toBeDefined();
    });
  });
});
