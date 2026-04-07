import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoadingOverlay, LoadingSpinner } from './LoadingSpinner';

const meta = {
  title: 'UI/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    size: { control: 'radio', options: ['sm', 'md', 'lg', 'xl'] },
    color: {
      control: 'radio',
      options: ['primary', 'secondary', 'accent', 'white'],
    },
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: 'sm' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const ExtraLarge: Story = {
  args: { size: 'xl' },
};

export const Secondary: Story = {
  args: { color: 'secondary' },
};

export const Accent: Story = {
  args: { color: 'accent' },
};

export const WithMessage: Story = {
  args: { message: '서버 데이터를 불러오는 중...' },
};

export const WithProgress: Story = {
  args: {
    showProgress: true,
    progress: 65,
  },
};

export const ProgressAlmostDone: Story = {
  args: {
    showProgress: true,
    progress: 96,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-xs text-gray-500">sm</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="md" />
        <span className="text-xs text-gray-500">md</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-gray-500">lg</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="xl" />
        <span className="text-xs text-gray-500">xl</span>
      </div>
    </div>
  ),
};

export const AllColors: Story = {
  render: () => (
    <div className="flex gap-6">
      {(['primary', 'secondary', 'accent', 'white'] as const).map((color) => (
        <div
          key={color}
          className={`flex flex-col items-center gap-2 rounded p-3 ${color === 'white' ? 'bg-gray-800' : ''}`}
        >
          <LoadingSpinner size="lg" color={color} />
          <span className="text-xs text-gray-500">{color}</span>
        </div>
      ))}
    </div>
  ),
};

export const Overlay: Story = {
  render: () => (
    <div className="relative h-64 w-96 rounded border border-gray-200 bg-gray-50">
      <p className="p-4 text-gray-600">배경 콘텐츠 영역</p>
      <LoadingOverlay isVisible progress={42} message="AI 분석 중..." />
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
