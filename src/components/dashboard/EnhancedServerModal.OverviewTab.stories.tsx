import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OverviewTab } from './EnhancedServerModal.OverviewTab';
import type { ServerData, StatusTheme } from './EnhancedServerModal.types';

const onlineTheme: StatusTheme = {
  gradient: 'from-emerald-500 to-green-600',
  bgLight: 'from-emerald-50 to-green-50',
  borderColor: 'border-emerald-200',
  textColor: 'text-emerald-700',
  badge: 'bg-emerald-100 text-emerald-700',
  icon: 'text-emerald-600',
};

const criticalTheme: StatusTheme = {
  gradient: 'from-red-500 to-rose-600',
  bgLight: 'from-red-50 to-rose-50',
  borderColor: 'border-red-200',
  textColor: 'text-red-700',
  badge: 'bg-red-100 text-red-700',
  icon: 'text-red-600',
};

const baseServer: ServerData = {
  id: 'api-prod-02',
  hostname: 'api-prod-02.kr-central',
  name: 'API Production 02',
  type: 'api',
  environment: 'production',
  location: 'Seoul, KR',
  provider: 'AWS',
  status: 'online',
  cpu: 35,
  memory: 52,
  disk: 40,
  uptime: '32일 8시간',
  lastUpdate: new Date(Date.now() - 120_000),
  alerts: 0,
  services: [
    { name: 'nginx', status: 'running', port: 443 },
    { name: 'node-api', status: 'running', port: 8080 },
    { name: 'redis', status: 'running', port: 6379 },
  ],
  os: 'Ubuntu 22.04 LTS',
  ip: '10.0.2.15',
  networkStatus: 'excellent',
  specs: {
    cpu_cores: 8,
    memory_gb: 32,
    disk_gb: 500,
    network_speed: '10 Gbps',
  },
};

const meta = {
  title: 'Dashboard/EnhancedServerModal.OverviewTab',
  component: OverviewTab,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl rounded-xl bg-gray-50 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OverviewTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: {
    server: baseServer,
    statusTheme: onlineTheme,
  },
};

export const Critical: Story = {
  args: {
    server: {
      ...baseServer,
      status: 'critical',
      name: 'DB Primary 01',
      type: 'database',
      cpu: 96,
      memory: 93,
      disk: 87,
      alerts: 5,
      services: [
        { name: 'postgresql', status: 'warning', port: 5432 },
        { name: 'pgbouncer', status: 'running', port: 6432 },
        { name: 'node-exporter', status: 'stopped', port: 9100 },
      ],
    },
    statusTheme: criticalTheme,
  },
};
