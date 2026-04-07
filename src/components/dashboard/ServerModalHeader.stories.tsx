import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { ServerData } from './EnhancedServerModal.types';
import { ServerModalHeader } from './ServerModalHeader';

const baseServer: ServerData = {
  id: 'web-prod-01',
  hostname: 'web-prod-01.kr-central',
  name: 'Web Production 01',
  type: 'web',
  environment: 'production',
  location: 'Seoul, KR',
  provider: 'AWS',
  status: 'online',
  cpu: 42,
  memory: 58,
  disk: 35,
  uptime: '45일 12시간',
  lastUpdate: new Date(),
  alerts: 0,
  services: [
    { name: 'nginx', status: 'running', port: 80 },
    { name: 'node', status: 'running', port: 3000 },
  ],
  os: 'Ubuntu 22.04',
  ip: '10.0.1.12',
  networkStatus: 'excellent',
};

const meta = {
  title: 'Dashboard/ServerModalHeader',
  component: ServerModalHeader,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-lg">
        <Story />
      </div>
    ),
  ],
  args: {
    isRealtime: true,
    onToggleRealtime: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ServerModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: {
    server: { ...baseServer, status: 'online' },
  },
};

export const Warning: Story = {
  args: {
    server: {
      ...baseServer,
      status: 'warning',
      name: 'API Gateway 03',
      type: 'api',
      cpu: 78,
      memory: 82,
      alerts: 3,
    },
  },
};

export const Critical: Story = {
  args: {
    server: {
      ...baseServer,
      status: 'critical',
      name: 'DB Primary 01',
      type: 'database',
      cpu: 95,
      memory: 91,
      disk: 88,
      alerts: 7,
    },
    isRealtime: false,
  },
};
