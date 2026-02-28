import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { userEvent } from 'storybook/test';
import { AIDebugPanel } from './AIDebugPanel';

const meta = {
  title: 'AISidebar/AIDebugPanel',
  component: AIDebugPanel,
  parameters: {
    layout: 'padded',
    mockData: [
      {
        url: '/api/ai/wake-up',
        method: 'POST',
        status: 200,
        response: { status: 'warm' },
      },
      {
        url: '/api/health?service=ai',
        method: 'GET',
        status: 200,
        response: { status: 'ok', latency: 42 },
      },
      {
        url: '/api/admin/log-level',
        method: 'GET',
        status: 200,
        response: {
          vercel: { level: 'info', defaultLevel: 'info' },
          cloudRun: { level: 'info', reachable: true },
        },
      },
      {
        url: '/api/admin/log-level',
        method: 'PUT',
        status: 200,
        response: {
          applied: { vercel: 'debug', cloudRun: 'debug' },
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-72 p-4 bg-white rounded-lg shadow-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AIDebugPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — idle */
export const Default: Story = {};

/** Log Level 섹션 펼침 */
export const LogLevelExpanded: Story = {
  play: async ({ canvas }) => {
    const logBtn = canvas.getByText('Log Level');
    await userEvent.click(logBtn);
  },
};
