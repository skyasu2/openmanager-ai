import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ServerStatusIndicator } from './ServerStatusIndicator';

const meta = {
  title: 'Shared/ServerStatusIndicator',
  component: ServerStatusIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ServerStatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: { status: 'online' },
};

export const Warning: Story = {
  args: { status: 'warning' },
};

export const Critical: Story = {
  args: { status: 'critical' },
};

export const Offline: Story = {
  args: { status: 'offline' },
};

export const Maintenance: Story = {
  args: { status: 'maintenance' },
};

export const Unknown: Story = {
  args: { status: 'unknown' },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="w-8 text-xs text-gray-500">sm</span>
        <ServerStatusIndicator status="online" size="sm" />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-8 text-xs text-gray-500">md</span>
        <ServerStatusIndicator status="online" size="md" />
      </div>
      <div className="flex items-center gap-4">
        <span className="w-8 text-xs text-gray-500">lg</span>
        <ServerStatusIndicator status="online" size="lg" />
      </div>
    </div>
  ),
};

export const IconOnly: Story = {
  args: { status: 'online', showText: false, size: 'md' },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="space-y-2">
      <ServerStatusIndicator status="online" />
      <ServerStatusIndicator status="warning" />
      <ServerStatusIndicator status="critical" />
      <ServerStatusIndicator status="offline" />
      <ServerStatusIndicator status="maintenance" />
      <ServerStatusIndicator status="unknown" />
    </div>
  ),
};
