import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ErrorMessage } from './ErrorMessage';

const meta = {
  title: 'UI/ErrorMessage',
  component: ErrorMessage,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    actions: [
      { label: '다시 시도', onClick: fn(), variant: 'primary' },
      { label: '홈으로', onClick: fn(), variant: 'secondary' },
    ],
  },
} satisfies Meta<typeof ErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Network: Story = {
  args: { type: 'network' },
};

export const Server: Story = {
  args: { type: 'server' },
};

export const Data: Story = {
  args: { type: 'data' },
};

export const AI: Story = {
  args: { type: 'ai' },
};

export const Auth: Story = {
  args: { type: 'auth' },
};

export const Unknown: Story = {
  args: { type: 'unknown' },
};

export const CustomMessage: Story = {
  args: {
    type: 'server',
    title: '점검 안내',
    message: '현재 서버 점검 중입니다. 14:00에 복구 예정입니다.',
  },
};

export const WithTechnicalDetails: Story = {
  args: {
    type: 'server',
    showTechnicalDetails: true,
    technicalError:
      'Error: ECONNREFUSED 127.0.0.1:8080\n  at TCPConnectWrap.afterConnect',
  },
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex max-w-4xl flex-col gap-6">
      {(['network', 'server', 'data', 'ai', 'auth', 'unknown'] as const).map(
        (type) => (
          <div key={type} className="rounded-lg border border-gray-200 p-2">
            <ErrorMessage type={type} actions={[]} />
          </div>
        )
      )}
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
