import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InlineAgentStatus, type AgentStep } from './InlineAgentStatus';

const meta = {
  title: 'AISidebar/InlineAgentStatus',
  component: InlineAgentStatus,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineAgentStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseSteps: AgentStep[] = [
  { id: '1', agent: 'supervisor', status: 'completed' },
  {
    id: '2',
    agent: 'nlq',
    status: 'processing',
    message: '서버 메트릭 조회 중',
  },
  { id: '3', agent: 'analyst', status: 'pending' },
  { id: '4', agent: 'reporter', status: 'pending' },
];

export const Processing: Story = {
  args: {
    steps: baseSteps,
    isComplete: false,
  },
};

export const AnalystPhase: Story = {
  args: {
    steps: [
      { id: '1', agent: 'supervisor', status: 'completed' },
      { id: '2', agent: 'nlq', status: 'completed' },
      {
        id: '3',
        agent: 'analyst',
        status: 'processing',
        message: 'CPU 패턴 분석',
      },
      { id: '4', agent: 'reporter', status: 'pending' },
    ],
    isComplete: false,
  },
};

export const WithError: Story = {
  args: {
    steps: [
      { id: '1', agent: 'supervisor', status: 'completed' },
      { id: '2', agent: 'nlq', status: 'error' },
      { id: '3', agent: 'analyst', status: 'pending' },
      { id: '4', agent: 'reporter', status: 'pending' },
    ],
    isComplete: false,
  },
};

export const AllCompleted: Story = {
  args: {
    steps: [
      { id: '1', agent: 'supervisor', status: 'completed' },
      { id: '2', agent: 'nlq', status: 'completed' },
      { id: '3', agent: 'analyst', status: 'completed' },
      { id: '4', agent: 'reporter', status: 'completed' },
    ],
    isComplete: true,
  },
};
