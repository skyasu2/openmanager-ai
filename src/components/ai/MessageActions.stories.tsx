import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { MessageActions } from './MessageActions';

const meta = {
  title: 'AI/MessageActions',
  component: MessageActions,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MessageActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssistantMsg: Story = {
  args: {
    messageId: 'msg-001',
    content:
      'web-server-03의 CPU 사용률이 92%로 임계치를 초과했습니다. 최근 30분간 지속적으로 상승 중이며, 프로세스 분석 결과 nginx worker 프로세스의 과부하가 원인으로 파악됩니다.',
    role: 'assistant',
    onFeedback: fn(),
    traceId: 'trace-abc-123',
  },
};

export const WithRegenerate: Story = {
  args: {
    messageId: 'msg-002',
    content:
      '현재 15개 서버 중 13개가 정상 운영 중이며, 2개 서버에서 경고가 감지되었습니다.',
    role: 'assistant',
    onRegenerate: fn(),
    onFeedback: fn(),
    showRegenerate: true,
    traceId: 'trace-def-456',
  },
};
