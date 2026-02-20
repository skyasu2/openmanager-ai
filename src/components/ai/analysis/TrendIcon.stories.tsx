import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TrendIcon } from './TrendIcon';

const meta = {
  title: 'AI/Analysis/TrendIcon',
  component: TrendIcon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof TrendIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Increasing: Story = {
  args: {
    trend: 'increasing',
  },
};

export const Decreasing: Story = {
  args: {
    trend: 'decreasing',
  },
};

export const Stable: Story = {
  args: {
    trend: 'stable',
  },
};
