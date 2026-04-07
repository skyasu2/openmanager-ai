import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { AsyncQueryProgress } from '../../hooks/ai/useAsyncAIQuery';
import { JobProgressIndicator } from './JobProgressIndicator';

const meta = {
  title: 'AISidebar/JobProgressIndicator',
  component: JobProgressIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JobProgressIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

const initProgress: AsyncQueryProgress = {
  stage: 'init',
  progress: 5,
  message: '요청 준비 중...',
};

const routingProgress: AsyncQueryProgress = {
  stage: 'routing',
  progress: 25,
  message: 'Supervisor가 적절한 에이전트 선택 중...',
};

const processingProgress: AsyncQueryProgress = {
  stage: 'processing',
  progress: 60,
  message: 'AI 에이전트가 응답 생성 중...',
};

const finalizingProgress: AsyncQueryProgress = {
  stage: 'finalizing',
  progress: 95,
  message: '응답 완료 처리 중...',
};

export const Initializing: Story = {
  args: {
    progress: initProgress,
    isLoading: true,
    jobId: 'job-abc12345-def6-7890',
    onCancel: fn(),
  },
};

export const Routing: Story = {
  args: {
    progress: routingProgress,
    isLoading: true,
    jobId: 'job-abc12345-def6-7890',
    onCancel: fn(),
  },
};

export const Processing: Story = {
  args: {
    progress: processingProgress,
    isLoading: true,
    jobId: 'job-abc12345-def6-7890',
    onCancel: fn(),
  },
};

export const Finalizing: Story = {
  args: {
    progress: finalizingProgress,
    isLoading: true,
    jobId: 'job-abc12345-def6-7890',
    onCancel: fn(),
  },
};

export const NlqAgent: Story = {
  args: {
    progress: {
      stage: 'nlq',
      progress: 40,
      message: 'NLQ Agent가 자연어 쿼리 처리 중...',
    },
    isLoading: true,
    jobId: 'job-nlq-98765432',
    onCancel: fn(),
  },
};

export const WithoutCancel: Story = {
  args: {
    progress: processingProgress,
    isLoading: true,
    jobId: 'job-abc12345-def6-7890',
  },
};
