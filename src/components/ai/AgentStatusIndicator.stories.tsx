import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AgentStatusIndicator } from './AgentStatusIndicator';

const meta = {
  title: 'AI/AgentStatusIndicator',
  component: AgentStatusIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AgentStatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Thinking: Story = {
  args: {
    agent: 'Orchestrator',
    status: 'thinking',
  },
};

export const Processing: Story = {
  args: {
    agent: 'NLQ Agent',
    status: 'processing',
  },
};

export const Completed: Story = {
  args: {
    agent: 'Analyst Agent',
    status: 'completed',
  },
};

export const Idle: Story = {
  args: {
    agent: 'Reporter Agent',
    status: 'idle',
  },
};
