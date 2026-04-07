import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AnomalySection } from './AnomalySection';

const meta = {
  title: 'AI/Analysis/AnomalySection',
  component: AnomalySection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnomalySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnomalies: Story = {
  args: {
    data: {
      success: true,
      serverId: 'srv-prod-01',
      serverName: 'Production API Server',
      anomalyCount: 2,
      hasAnomalies: true,
      results: {
        cpu: {
          isAnomaly: true,
          severity: 'high',
          confidence: 0.93,
          currentValue: 95.2,
          threshold: { upper: 85, lower: 10 },
        },
        memory: {
          isAnomaly: true,
          severity: 'medium',
          confidence: 0.81,
          currentValue: 82.7,
          threshold: { upper: 80, lower: 20 },
        },
        disk: {
          isAnomaly: false,
          severity: 'low',
          confidence: 0.95,
          currentValue: 48.3,
          threshold: { upper: 90, lower: 5 },
        },
      },
      timestamp: '2026-02-20T14:30:00Z',
      _algorithm: 'z-score + IQR hybrid',
      _engine: 'cloud-run',
      _cached: false,
    },
  },
};

export const AllNormal: Story = {
  args: {
    data: {
      success: true,
      serverId: 'srv-web-03',
      serverName: 'Web Frontend Server',
      anomalyCount: 0,
      hasAnomalies: false,
      results: {
        cpu: {
          isAnomaly: false,
          severity: 'low',
          confidence: 0.97,
          currentValue: 32.4,
          threshold: { upper: 85, lower: 10 },
        },
        memory: {
          isAnomaly: false,
          severity: 'low',
          confidence: 0.94,
          currentValue: 55.1,
          threshold: { upper: 80, lower: 20 },
        },
        disk: {
          isAnomaly: false,
          severity: 'low',
          confidence: 0.99,
          currentValue: 41.8,
          threshold: { upper: 90, lower: 5 },
        },
      },
      timestamp: '2026-02-20T14:30:00Z',
      _algorithm: 'z-score + IQR hybrid',
      _engine: 'cloud-run',
      _cached: true,
    },
  },
};
