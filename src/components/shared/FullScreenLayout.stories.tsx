import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FullScreenLayout from './FullScreenLayout';

const meta = {
  title: 'Shared/FullScreenLayout',
  component: FullScreenLayout,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    className: {
      control: 'text',
      description: '추가 CSS 클래스',
    },
  },
} satisfies Meta<typeof FullScreenLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">
          FullScreenLayout Default
        </h1>
        <p className="mt-2 text-white/70">
          배경 그라디언트와 중앙 정렬이 적용된 전체 화면 레이아웃
        </p>
      </div>
    ),
  },
};

export const WithClassName: Story = {
  args: {
    className: 'p-8 gap-4 flex-col',
    children: (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-white">커스텀 클래스 적용</h1>
        <p className="mt-2 text-white/70">
          className prop으로 추가 스타일을 지정할 수 있습니다
        </p>
      </div>
    ),
  },
};
