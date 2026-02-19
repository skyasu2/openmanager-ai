import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ColdStartErrorBanner } from './ColdStartErrorBanner';

const meta = {
  title: 'AISidebar/ColdStartErrorBanner',
  component: ColdStartErrorBanner,
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
} satisfies Meta<typeof ColdStartErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColdStart: Story = {
  args: {
    error: 'Cloud Run cold start: Service Unavailable (503)',
    onRetry: fn(),
    onClearError: fn(),
  },
};

export const GeneralError: Story = {
  args: {
    error: '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    onRetry: fn(),
    onClearError: fn(),
  },
};

export const ModelConfigError: Story = {
  args: {
    error: 'Model not found: cerebras/llama-3.3-70b (404)',
    onRetry: fn(),
    onClearError: fn(),
  },
};

export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Cold Start 에러:</p>
      <ColdStartErrorBanner
        error="Cloud Run cold start: Service Unavailable (503)"
        onRetry={fn()}
        onClearError={fn()}
      />
      <p className="text-sm font-medium text-gray-700">모델 설정 에러:</p>
      <ColdStartErrorBanner
        error="Model not found: cerebras/llama-3.3-70b (404)"
        onRetry={fn()}
        onClearError={fn()}
      />
      <p className="text-sm font-medium text-gray-700">일반 에러:</p>
      <ColdStartErrorBanner
        error="네트워크 연결이 불안정합니다."
        onRetry={fn()}
        onClearError={fn()}
      />
    </div>
  ),
};
