import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AgentHandoffBadge } from './AgentHandoffBadge';

const meta = {
  title: 'AI/AgentHandoffBadge',
  component: AgentHandoffBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AgentHandoffBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    from: 'Orchestrator',
    to: 'NLQ Agent',
  },
};

export const WithReason: Story = {
  args: {
    from: 'NLQ Agent',
    to: 'Analyst Agent',
    reason: '서버 메트릭 패턴 분석 필요',
  },
};

export const Compact: Story = {
  args: {
    from: 'Analyst Agent',
    to: 'Reporter Agent',
    reason: '보고서 생성 위임',
    compact: true,
  },
};
