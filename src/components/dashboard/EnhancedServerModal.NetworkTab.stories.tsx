import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NetworkTab } from './EnhancedServerModal.NetworkTab';
import type { RealtimeData, ServerData } from './EnhancedServerModal.types';

const sampleServer: ServerData = {
  id: 'lb-prod-01',
  hostname: 'lb-prod-01.kr-central',
  name: 'Load Balancer 01',
  type: 'load-balancer',
  environment: 'production',
  location: 'Seoul, KR',
  provider: 'AWS',
  status: 'online',
  cpu: 28,
  memory: 45,
  disk: 22,
  uptime: '90일 3시간',
  lastUpdate: new Date(),
  alerts: 0,
  services: [
    { name: 'haproxy', status: 'running', port: 80 },
    { name: 'keepalived', status: 'running', port: 112 },
  ],
  os: 'Ubuntu 22.04',
  ip: '10.0.0.5',
  networkStatus: 'excellent',
  specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100, network_speed: '10 Gbps' },
};

const sampleRealtimeData: RealtimeData = {
  cpu: [28, 30, 27, 32, 29, 31, 28, 33, 30, 27],
  memory: [45, 44, 46, 45, 47, 44, 45, 46, 44, 45],
  disk: [22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  network: [12.4, 15.2, 18.7, 14.3, 16.8, 20.1, 17.5, 19.3, 15.6, 18.2],
  logs: [
    {
      timestamp: '2026-02-20T10:00:00Z',
      level: 'info',
      message: 'Health check passed',
    },
    {
      timestamp: '2026-02-20T10:01:00Z',
      level: 'info',
      message: 'Connection pool stable',
    },
  ],
};

const meta = {
  title: 'Dashboard/EnhancedServerModal.NetworkTab',
  component: NetworkTab,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl rounded-xl bg-gray-50 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NetworkTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    server: sampleServer,
    realtimeData: sampleRealtimeData,
  },
};
