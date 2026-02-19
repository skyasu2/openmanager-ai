import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { Textarea } from './textarea';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: '메시지를 입력하세요...' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-[350px] space-y-2">
      <Label htmlFor="message">AI 질문</Label>
      <Textarea id="message" placeholder="서버 상태를 분석해주세요..." />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: '수정할 수 없는 텍스트 영역입니다.' },
};

export const WithRows: Story = {
  args: { rows: 6, placeholder: '상세 설명을 입력하세요...' },
};
