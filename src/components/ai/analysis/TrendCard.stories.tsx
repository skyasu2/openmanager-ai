import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TrendCard } from './TrendCard';

const meta = {
  title: 'AI/Analysis/TrendCard',
  component: TrendCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {
  args: {
    metric: 'cpu',
    data: {
      trend: 'increasing',
      currentValue: 72,
      predictedValue: 89,
      changePercent: 23.6,
      confidence: 0.85,
    },
  },
};

export const Falling: Story = {
  args: {
    metric: 'memory',
    data: {
      trend: 'decreasing',
      currentValue: 68,
      predictedValue: 55,
      changePercent: -19.1,
      confidence: 0.78,
    },
  },
};

export const Stable: Story = {
  args: {
    metric: 'disk',
    data: {
      trend: 'stable',
      currentValue: 45,
      predictedValue: 46,
      changePercent: 2.2,
      confidence: 0.91,
    },
  },
};
