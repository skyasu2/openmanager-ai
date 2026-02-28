import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StreamingWarmupIndicator } from './StreamingWarmupIndicator';

const meta = {
  title: 'AISidebar/StreamingWarmupIndicator',
  component: StreamingWarmupIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StreamingWarmupIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    estimatedWaitSeconds: 60,
  },
};

export const ShortWait: Story = {
  args: {
    estimatedWaitSeconds: 10,
  },
};
