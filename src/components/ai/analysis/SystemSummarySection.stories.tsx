import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SystemSummarySection } from './SystemSummarySection';

const meta = {
  title: 'AI/Analysis/SystemSummarySection',
  component: SystemSummarySection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SystemSummarySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: {
    summary: {
      totalServers: 12,
      healthyServers: 12,
      warningServers: 0,
      criticalServers: 0,
      overallStatus: 'online',
      topIssues: [],
      predictions: [],
    },
  },
};

export const Warning: Story = {
  args: {
    summary: {
      totalServers: 12,
      healthyServers: 9,
      warningServers: 3,
      criticalServers: 0,
      overallStatus: 'warning',
      topIssues: [
        {
          serverId: 'srv-api-02',
          serverName: 'API Gateway #2',
          metric: 'cpu',
          severity: 'medium',
          currentValue: 78,
        },
        {
          serverId: 'srv-db-01',
          serverName: 'Primary DB',
          metric: 'memory',
          severity: 'medium',
          currentValue: 82,
        },
      ],
      predictions: [
        {
          serverId: 'srv-api-02',
          serverName: 'API Gateway #2',
          metric: 'cpu',
          trend: 'increasing',
          predictedValue: 88,
          changePercent: 12.8,
        },
      ],
    },
  },
};

export const Critical: Story = {
  args: {
    summary: {
      totalServers: 12,
      healthyServers: 7,
      warningServers: 3,
      criticalServers: 2,
      overallStatus: 'critical',
      topIssues: [
        {
          serverId: 'srv-prod-01',
          serverName: 'Production API',
          metric: 'cpu',
          severity: 'high',
          currentValue: 97,
        },
        {
          serverId: 'srv-prod-02',
          serverName: 'Production Worker',
          metric: 'memory',
          severity: 'high',
          currentValue: 94,
        },
        {
          serverId: 'srv-db-01',
          serverName: 'Primary DB',
          metric: 'disk',
          severity: 'medium',
          currentValue: 85,
        },
      ],
      predictions: [
        {
          serverId: 'srv-prod-01',
          serverName: 'Production API',
          metric: 'cpu',
          trend: 'increasing',
          predictedValue: 99,
          changePercent: 15.3,
        },
        {
          serverId: 'srv-prod-02',
          serverName: 'Production Worker',
          metric: 'memory',
          trend: 'increasing',
          predictedValue: 98,
          changePercent: 8.7,
        },
      ],
    },
  },
};
