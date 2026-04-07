import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ResizeHandle } from './ResizeHandle';

const meta = {
  title: 'AISidebar/ResizeHandle',
  component: ResizeHandle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onMouseDown: fn(),
    onTouchStart: fn(),
    isResizing: false,
  },
  decorators: [
    (Story) => (
      <div className="relative h-64 w-32 rounded-lg border border-gray-200 bg-gray-50">
        <Story />
        <p className="p-4 text-xs text-gray-400">
          좌측 가장자리를 드래그하세요
        </p>
      </div>
    ),
  ],
};

export const Resizing: Story = {
  args: {
    onMouseDown: fn(),
    onTouchStart: fn(),
    isResizing: true,
  },
  decorators: [
    (Story) => (
      <div className="relative h-64 w-32 rounded-lg border border-blue-300 bg-blue-50">
        <Story />
        <p className="p-4 text-xs text-blue-400">리사이징 중...</p>
      </div>
    ),
  ],
};
