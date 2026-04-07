import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, mocked } from 'storybook/test';
import { useServerMetrics } from '../../hooks/useServerMetrics';
import type { Server } from '../../types/server';
import ImprovedServerCard from './ImprovedServerCard';

const onlineServer: Server = {
  id: 'web-nginx-dc1-01',
  name: 'web-nginx-dc1-01',
  status: 'online',
  cpu: 30,
  memory: 48,
  disk: 30,
  location: 'DC1-AZ1',
  uptime: '405d 18h',
  ip: '10.100.1.11',
  os: 'linux',
  type: 'web',
};

const warningServer: Server = {
  id: 'cache-redis-dc1-01',
  name: 'cache-redis-dc1-01',
  status: 'warning',
  cpu: 55,
  memory: 74,
  disk: 42,
  location: 'DC1-AZ2',
  uptime: '120d 4h',
  ip: '10.100.3.11',
  os: 'linux',
  type: 'database',
};

const criticalServer: Server = {
  id: 'db-mysql-dc1-primary',
  name: 'db-mysql-dc1-primary',
  status: 'critical',
  cpu: 92,
  memory: 95,
  disk: 88,
  location: 'DC1-AZ1',
  uptime: '30d 2h',
  ip: '10.100.2.11',
  os: 'linux',
  type: 'database',
};

const offlineServer: Server = {
  id: 'monitor-dc1-01',
  name: 'monitor-dc1-01',
  status: 'offline',
  cpu: 0,
  memory: 0,
  disk: 45,
  location: 'DC1-AZ3',
  uptime: '0',
  ip: '10.100.5.11',
  os: 'linux',
  type: 'monitoring',
};

const meta = {
  title: 'Dashboard/ImprovedServerCard',
  component: ImprovedServerCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
  args: {
    onClick: fn(),
    variant: 'standard',
    showRealTimeUpdates: true,
    enableProgressiveDisclosure: true,
  },
  beforeEach() {
    mocked(useServerMetrics).mockReturnValue({
      metricsHistory: [],
      isLoadingHistory: false,
      loadMetricsHistory: fn().mockResolvedValue(undefined),
    } as never);
  },
} satisfies Meta<typeof ImprovedServerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: { server: onlineServer },
};

export const Warning: Story = {
  args: { server: warningServer },
};

export const Critical: Story = {
  args: { server: criticalServer },
};

export const Offline: Story = {
  args: { server: offlineServer },
};

export const Compact: Story = {
  args: { server: onlineServer, variant: 'compact' },
};

export const AllStatuses: Story = {
  decorators: [
    (_Story) => (
      <div className="grid w-[900px] grid-cols-2 gap-4">
        <ImprovedServerCard server={onlineServer} onClick={fn()} />
        <ImprovedServerCard server={warningServer} onClick={fn()} />
        <ImprovedServerCard server={criticalServer} onClick={fn()} />
        <ImprovedServerCard server={offlineServer} onClick={fn()} />
      </div>
    ),
  ],
};
