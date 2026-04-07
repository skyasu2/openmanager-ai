import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProcessesTab } from './EnhancedServerModal.ProcessesTab';
import type { ServerService } from './EnhancedServerModal.types';

const allRunningServices: ServerService[] = [
  { name: 'nginx', status: 'running', port: 443 },
  { name: 'node-api', status: 'running', port: 8080 },
  { name: 'redis', status: 'running', port: 6379 },
  { name: 'postgresql', status: 'running', port: 5432 },
  { name: 'prometheus', status: 'running', port: 9090 },
  { name: 'grafana', status: 'running', port: 3000 },
];

const mixedServices: ServerService[] = [
  { name: 'nginx', status: 'running', port: 443 },
  { name: 'node-api', status: 'running', port: 8080 },
  { name: 'redis', status: 'warning', port: 6379 },
  { name: 'postgresql', status: 'error', port: 5432 },
  { name: 'prometheus', status: 'running', port: 9090 },
  { name: 'grafana', status: 'stopped', port: 3000 },
  { name: 'celery-worker', status: 'starting', port: 5555 },
];

const meta = {
  title: 'Dashboard/EnhancedServerModal.ProcessesTab',
  component: ProcessesTab,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl rounded-xl bg-gray-50 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllRunning: Story = {
  args: {
    services: allRunningServices,
  },
};

export const MixedStatus: Story = {
  args: {
    services: mixedServices,
  },
};
