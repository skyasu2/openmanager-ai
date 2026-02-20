import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TrendSection } from './TrendSection';

const meta = {
  title: 'AI/Analysis/TrendSection',
  component: TrendSection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRisingTrends: Story = {
  args: {
    data: {
      success: true,
      serverId: 'srv-prod-01',
      serverName: 'Production API Server',
      predictionHorizon: '30분',
      results: {
        cpu: {
          trend: 'increasing',
          currentValue: 72,
          predictedValue: 91,
          changePercent: 26.4,
          confidence: 0.87,
        },
        memory: {
          trend: 'increasing',
          currentValue: 65,
          predictedValue: 78,
          changePercent: 20.0,
          confidence: 0.82,
        },
        disk: {
          trend: 'stable',
          currentValue: 48,
          predictedValue: 49,
          changePercent: 2.1,
          confidence: 0.95,
        },
      },
      summary: {
        increasingMetrics: ['cpu', 'memory'],
        hasRisingTrends: true,
      },
      timestamp: '2026-02-20T14:30:00Z',
      _algorithm: 'linear-regression',
      _engine: 'cloud-run',
      _cached: false,
    },
  },
};

export const AllStable: Story = {
  args: {
    data: {
      success: true,
      serverId: 'srv-web-03',
      serverName: 'Web Frontend Server',
      predictionHorizon: '30분',
      results: {
        cpu: {
          trend: 'stable',
          currentValue: 35,
          predictedValue: 36,
          changePercent: 2.9,
          confidence: 0.93,
        },
        memory: {
          trend: 'decreasing',
          currentValue: 60,
          predictedValue: 54,
          changePercent: -10.0,
          confidence: 0.88,
        },
        disk: {
          trend: 'stable',
          currentValue: 42,
          predictedValue: 42,
          changePercent: 0.0,
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
  },
};
