import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from './skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { className: 'h-4 w-[250px]' },
};

export const Circle: Story = {
  args: { className: 'h-12 w-12 rounded-full' },
};

export const CardSkeleton: Story = {
  render: () => (
    <div className="w-[350px] space-y-4 rounded-lg border p-6">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[80%]" />
    </div>
  ),
};

export const ServerCardSkeleton: Story = {
  render: () => (
    <div className="w-[300px] space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-[120px]" />
        <Skeleton className="h-5 w-[60px] rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-[40px]" />
          <Skeleton className="h-3 w-[30px]" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-[50px]" />
          <Skeleton className="h-3 w-[30px]" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  ),
};
