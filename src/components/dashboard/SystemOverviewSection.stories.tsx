import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { Server } from '@/types/server';
import { SystemOverviewSection } from './SystemOverviewSection';

const sampleServers: Server[] = [
  {
    id: 'web-prod-01',
    name: 'Web Production 01',
    status: 'online',
    cpu: 42,
    memory: 58,
    disk: 35,
    location: 'Seoul, KR',
    uptime: '45일',
  },
  {
    id: 'api-prod-02',
    name: 'API Gateway 02',
    status: 'warning',
    cpu: 78,
    memory: 82,
    disk: 45,
    location: 'Seoul, KR',
    uptime: '30일',
  },
  {
    id: 'db-prod-01',
    name: 'DB Primary 01',
    status: 'critical',
    cpu: 95,
    memory: 91,
    disk: 88,
    location: 'Seoul, KR',
    uptime: '12일',
  },
  {
    id: 'cache-prod-01',
    name: 'Redis Cache 01',
    status: 'online',
    cpu: 15,
    memory: 62,
    disk: 10,
    location: 'Seoul, KR',
    uptime: '60일',
  },
];

const meta = {
  title: 'Dashboard/SystemOverviewSection',
  component: SystemOverviewSection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SystemOverviewSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FourServers: Story = {
  args: {
    servers: sampleServers,
  },
};

export const Empty: Story = {
  args: {
    servers: [],
  },
};
