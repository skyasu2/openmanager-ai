import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DashboardSummary } from './DashboardSummary';
import type { DashboardStats } from './types/dashboard.types';

const allOnlineStats: DashboardStats = {
  total: 24,
  online: 24,
  warning: 0,
  critical: 0,
  offline: 0,
  unknown: 0,
};

const mixedStats: DashboardStats = {
  total: 24,
  online: 18,
  warning: 3,
  critical: 1,
  offline: 2,
  unknown: 0,
};

const alertStats: DashboardStats = {
  total: 24,
  online: 12,
  warning: 5,
  critical: 4,
  offline: 3,
  unknown: 0,
};

const meta = {
  title: 'Dashboard/DashboardSummary',
  component: DashboardSummary,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-6xl">
        <Story />
      </div>
    ),
  ],
  args: {
    onFilterChange: fn(),
    onOpenAlertHistory: fn(),
    onOpenLogExplorer: fn(),
  },
} satisfies Meta<typeof DashboardSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllOnline: Story = {
  args: {
    stats: allOnlineStats,
    activeFilter: null,
    activeAlertsCount: 0,
  },
};

export const MixedStatus: Story = {
  tags: ['interaction-test'],
  args: {
    stats: mixedStats,
    activeFilter: null,
    activeAlertsCount: 4,
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('status filter cards are actionable', async () => {
      const warningFilter = canvas.getByRole('button', {
        name: '경고 3대 필터',
      });

      await expect(warningFilter).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(warningFilter);
      await expect(args.onFilterChange).toHaveBeenCalledWith('warning');
    });

    await step('header action buttons call their handlers', async () => {
      await userEvent.click(canvas.getByRole('button', { name: '알림 보기' }));
      await expect(args.onOpenAlertHistory).toHaveBeenCalled();

      await userEvent.click(
        canvas.getByRole('button', { name: '로그 검색 보기' })
      );
      await expect(args.onOpenLogExplorer).toHaveBeenCalled();
    });
  },
};

export const WithAlerts: Story = {
  args: {
    stats: alertStats,
    activeFilter: 'critical',
    activeAlertsCount: 12,
  },
};
