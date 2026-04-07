import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ServerResultCard } from './ServerResultCard';

const meta = {
  title: 'AI/Analysis/ServerResultCard',
  component: ServerResultCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ServerResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: {
    server: {
      success: true,
      serverId: 'srv-web-03',
      serverName: 'Web Frontend Server',
      analysisType: 'full',
      timestamp: '2026-02-20T14:30:00Z',
      overallStatus: 'online',
      anomalyDetection: {
        success: true,
        serverId: 'srv-web-03',
        serverName: 'Web Frontend Server',
        anomalyCount: 0,
        hasAnomalies: false,
        results: {
          cpu: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.96,
            currentValue: 28.5,
            threshold: { upper: 85, lower: 10 },
          },
          memory: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.94,
            currentValue: 52.3,
            threshold: { upper: 80, lower: 20 },
          },
          disk: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.98,
            currentValue: 38.7,
            threshold: { upper: 90, lower: 5 },
          },
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'z-score + IQR hybrid',
        _engine: 'cloud-run',
        _cached: true,
      },
      trendPrediction: {
        success: true,
        serverId: 'srv-web-03',
        serverName: 'Web Frontend Server',
        predictionHorizon: '30분',
        results: {
          cpu: {
            trend: 'stable',
            currentValue: 28.5,
            predictedValue: 30,
            changePercent: 5.3,
            confidence: 0.91,
          },
          memory: {
            trend: 'stable',
            currentValue: 52.3,
            predictedValue: 53,
            changePercent: 1.3,
            confidence: 0.93,
          },
          disk: {
            trend: 'stable',
            currentValue: 38.7,
            predictedValue: 39,
            changePercent: 0.8,
            confidence: 0.97,
          },
        },
        summary: {
          increasingMetrics: [],
          hasRisingTrends: false,
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'linear-regression',
        _engine: 'cloud-run',
        _cached: true,
      },
      patternAnalysis: {
        success: true,
        patterns: ['stable_operation'],
        detectedIntent: 'status_check',
        analysisResults: [
          {
            pattern: '안정 운영',
            confidence: 0.95,
            insights:
              '모든 메트릭이 정상 범위 내에서 안정적으로 운영되고 있습니다.',
          },
        ],
        _mode: 'full-analysis',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    server: {
      success: true,
      serverId: 'srv-api-02',
      serverName: 'API Gateway #2',
      analysisType: 'full',
      timestamp: '2026-02-20T14:30:00Z',
      overallStatus: 'warning',
      anomalyDetection: {
        success: true,
        serverId: 'srv-api-02',
        serverName: 'API Gateway #2',
        anomalyCount: 1,
        hasAnomalies: true,
        results: {
          cpu: {
            isAnomaly: true,
            severity: 'medium',
            confidence: 0.84,
            currentValue: 78.2,
            threshold: { upper: 75, lower: 10 },
          },
          memory: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.91,
            currentValue: 61.5,
            threshold: { upper: 80, lower: 20 },
          },
          disk: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.96,
            currentValue: 55.0,
            threshold: { upper: 90, lower: 5 },
          },
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'z-score + IQR hybrid',
        _engine: 'cloud-run',
        _cached: false,
      },
      trendPrediction: {
        success: true,
        serverId: 'srv-api-02',
        serverName: 'API Gateway #2',
        predictionHorizon: '30분',
        results: {
          cpu: {
            trend: 'increasing',
            currentValue: 78.2,
            predictedValue: 88,
            changePercent: 12.5,
            confidence: 0.83,
          },
          memory: {
            trend: 'stable',
            currentValue: 61.5,
            predictedValue: 63,
            changePercent: 2.4,
            confidence: 0.89,
          },
          disk: {
            trend: 'stable',
            currentValue: 55.0,
            predictedValue: 55,
            changePercent: 0.0,
            confidence: 0.95,
          },
        },
        summary: {
          increasingMetrics: ['cpu'],
          hasRisingTrends: true,
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'linear-regression',
        _engine: 'cloud-run',
        _cached: false,
      },
      patternAnalysis: {
        success: true,
        patterns: ['gradual_increase'],
        detectedIntent: 'performance_analysis',
        analysisResults: [
          {
            pattern: '점진적 CPU 증가',
            confidence: 0.82,
            insights:
              'API 트래픽 증가에 따른 CPU 부하 상승이 감지되었습니다. 오토스케일링 임계값 조정을 권장합니다.',
          },
        ],
        _mode: 'full-analysis',
      },
    },
  },
};

export const Critical: Story = {
  args: {
    server: {
      success: true,
      serverId: 'srv-prod-01',
      serverName: 'Production API Server',
      analysisType: 'full',
      timestamp: '2026-02-20T14:30:00Z',
      overallStatus: 'critical',
      anomalyDetection: {
        success: true,
        serverId: 'srv-prod-01',
        serverName: 'Production API Server',
        anomalyCount: 2,
        hasAnomalies: true,
        results: {
          cpu: {
            isAnomaly: true,
            severity: 'high',
            confidence: 0.95,
            currentValue: 97.1,
            threshold: { upper: 85, lower: 10 },
          },
          memory: {
            isAnomaly: true,
            severity: 'high',
            confidence: 0.91,
            currentValue: 93.8,
            threshold: { upper: 80, lower: 20 },
          },
          disk: {
            isAnomaly: false,
            severity: 'low',
            confidence: 0.94,
            currentValue: 67.2,
            threshold: { upper: 90, lower: 5 },
          },
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'z-score + IQR hybrid',
        _engine: 'cloud-run',
        _cached: false,
      },
      trendPrediction: {
        success: true,
        serverId: 'srv-prod-01',
        serverName: 'Production API Server',
        predictionHorizon: '30분',
        results: {
          cpu: {
            trend: 'increasing',
            currentValue: 97.1,
            predictedValue: 99,
            changePercent: 5.8,
            confidence: 0.79,
          },
          memory: {
            trend: 'increasing',
            currentValue: 93.8,
            predictedValue: 98,
            changePercent: 10.2,
            confidence: 0.85,
          },
          disk: {
            trend: 'increasing',
            currentValue: 67.2,
            predictedValue: 72,
            changePercent: 7.1,
            confidence: 0.88,
          },
        },
        summary: {
          increasingMetrics: ['cpu', 'memory', 'disk'],
          hasRisingTrends: true,
        },
        timestamp: '2026-02-20T14:30:00Z',
        _algorithm: 'linear-regression',
        _engine: 'cloud-run',
        _cached: false,
      },
      patternAnalysis: {
        success: true,
        patterns: ['resource_exhaustion', 'memory_leak'],
        detectedIntent: 'critical_alert',
        analysisResults: [
          {
            pattern: '리소스 고갈 위험',
            confidence: 0.93,
            insights:
              'CPU와 메모리가 동시에 임계치를 초과했습니다. 즉각적인 스케일업 또는 서비스 분산이 필요합니다.',
          },
          {
            pattern: '메모리 누수 의심',
            confidence: 0.78,
            insights:
              '지속적인 메모리 증가 패턴이 감지되었습니다. 애플리케이션 레벨의 메모리 프로파일링을 권장합니다.',
          },
        ],
        _mode: 'full-analysis',
      },
    },
  },
};
