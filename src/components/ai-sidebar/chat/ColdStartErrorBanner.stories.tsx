import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
    error: 'Stream error: Cloud Run AI Engine timeout after 30s',
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
    error: 'The model does not exist or you do not have access to it (404)',
    onRetry: fn(),
    onClearError: fn(),
  },
};

export const RetryInteraction: Story = {
  args: {
    error: '네트워크 연결이 불안정합니다.',
    onRetry: fn(),
    onClearError: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '재시도' }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Cold Start 에러:</p>
      <ColdStartErrorBanner
        error="Stream error: Cloud Run AI Engine timeout after 30s"
        onRetry={fn()}
        onClearError={fn()}
      />
      <p className="text-sm font-medium text-gray-700">모델 설정 에러:</p>
      <ColdStartErrorBanner
        error="The model does not exist or you do not have access to it (404)"
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
