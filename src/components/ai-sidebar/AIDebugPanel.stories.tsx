import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, userEvent } from 'storybook/test';
import { AIDebugPanel } from './AIDebugPanel';

type MockRoute = {
  path: string;
  method: 'GET' | 'POST' | 'PUT';
  status: number;
  body: unknown;
};

const MOCK_ROUTES: MockRoute[] = [
  {
    path: '/api/ai/wake-up',
    method: 'POST',
    status: 200,
    body: { status: 'warm' },
  },
  {
    path: '/api/health?service=ai',
    method: 'GET',
    status: 200,
    body: { status: 'ok', latency: 42 },
  },
  {
    path: '/api/admin/log-level',
    method: 'GET',
    status: 200,
    body: {
      vercel: { level: 'info', defaultLevel: 'info' },
      cloudRun: { level: 'info', reachable: true },
    },
  },
  {
    path: '/api/admin/log-level',
    method: 'PUT',
    status: 200,
    body: {
      applied: { vercel: 'debug', cloudRun: 'debug' },
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    },
  },
];

function normalizeRequestTarget(input: Parameters<typeof fetch>[0]): string {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const normalized = new URL(raw, 'https://storybook.local');
  return `${normalized.pathname}${normalized.search}`;
}

function setupFetchMock() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = fn(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const path = normalizeRequestTarget(input);
      const method =
        init?.method?.toUpperCase() ??
        (typeof input === 'string' || input instanceof URL
          ? 'GET'
          : input.method.toUpperCase());

      const match = MOCK_ROUTES.find(
        (route) => route.path === path && route.method === method
      );

      if (!match) {
        return new Response(
          JSON.stringify({ error: `Unhandled ${method} ${path}` }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify(match.body), {
        status: match.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  ) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

const meta = {
  title: 'AISidebar/AIDebugPanel',
  component: AIDebugPanel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-72 p-4 bg-white rounded-lg shadow-md">
        <Story />
      </div>
    ),
  ],
  beforeEach() {
    return setupFetchMock();
  },
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
