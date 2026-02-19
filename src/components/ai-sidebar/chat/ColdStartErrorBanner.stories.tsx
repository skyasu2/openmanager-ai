import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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

/**
 * 다단계 자동 재시도 검증
 * - 초기 렌더 시 "시도 1/3" 표시 확인
 * - 프로그레스 바와 카운트다운 텍스트 존재 확인
 * - "자동 재시도 취소" 버튼 존재 확인
 */
export const MultiStepRetry: Story = {
  args: {
    error: 'Stream error: Cloud Run AI Engine timeout after 30s',
    onRetry: fn(),
    onClearError: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement);

    // 초기 상태: "시도 1/3" 텍스트 확인
    await waitFor(() => {
      expect(screen.getByText(/시도 1\/3/)).toBeInTheDocument();
    });

    // 프로그레스 바 존재 확인
    expect(screen.getByText(/초 후 재시도/)).toBeInTheDocument();

    // 자동 재시도 취소 버튼 존재 확인
    expect(screen.getByText('자동 재시도 취소')).toBeInTheDocument();

    // "지금 재시도" 클릭 시 자동 재시도 취소 + onRetry 호출
    await userEvent.click(screen.getByRole('button', { name: '지금 재시도' }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/**
 * 자동 재시도 취소 검증
 * - "자동 재시도 취소" 클릭 시 카운트다운 중지 확인
 */
export const CancelAutoRetry: Story = {
  args: {
    error: 'Stream error: Cloud Run AI Engine timeout after 30s',
    onRetry: fn(),
    onClearError: fn(),
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement);

    // 자동 재시도 상태 확인
    await waitFor(() => {
      expect(screen.getByText(/시도 1\/3/)).toBeInTheDocument();
    });

    // 취소 클릭
    await userEvent.click(screen.getByText('자동 재시도 취소'));

    // 카운트다운 관련 UI 사라짐 확인
    await waitFor(() => {
      expect(screen.queryByText(/시도 1\/3/)).not.toBeInTheDocument();
    });
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
