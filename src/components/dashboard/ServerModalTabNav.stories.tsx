import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Activity, Cpu, Globe, ScrollText, Settings } from 'lucide-react';
import { fn } from 'storybook/test';
import type { TabInfo } from './EnhancedServerModal.types';
import { ServerModalTabNav } from './ServerModalTabNav';

const sampleTabs: TabInfo[] = [
  { id: 'overview', label: '개요', icon: Activity },
  { id: 'metrics', label: '메트릭', icon: Cpu },
  { id: 'processes', label: '서비스', icon: Settings },
  { id: 'logs', label: '로그', icon: ScrollText },
  { id: 'network', label: '네트워크', icon: Globe },
];

const meta = {
  title: 'Dashboard/ServerModalTabNav',
  component: ServerModalTabNav,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl rounded-xl bg-gray-50 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    tabs: sampleTabs,
    onTabSelect: fn(),
  },
} satisfies Meta<typeof ServerModalTabNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedTab: 'overview',
  },
};

export const SecondTabSelected: Story = {
  args: {
    selectedTab: 'metrics',
  },
};
