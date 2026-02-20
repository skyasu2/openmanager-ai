import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import ServerDashboardPaginationControls from './ServerDashboardPaginationControls';

const meta = {
  title: 'Dashboard/ServerDashboardPaginationControls',
  component: ServerDashboardPaginationControls,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    onPageChange: fn(),
    onPageSizeChange: fn(),
  },
} satisfies Meta<typeof ServerDashboardPaginationControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 9,
    totalServers: 6,
  },
};

export const MultiPage: Story = {
  args: {
    currentPage: 3,
    totalPages: 8,
    pageSize: 6,
    totalServers: 48,
  },
};
