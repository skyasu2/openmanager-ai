import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'AI 활성' },
};

export const Success: Story = {
  args: { variant: 'success', children: '정상' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: '경고' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: '장애' },
};

export const Info: Story = {
  args: { variant: 'info', children: '정보' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: '비활성' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'v8.0.0' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">AI 활성</Badge>
      <Badge variant="success">정상</Badge>
      <Badge variant="warning">경고</Badge>
      <Badge variant="destructive">장애</Badge>
      <Badge variant="info">정보</Badge>
      <Badge variant="secondary">비활성</Badge>
      <Badge variant="outline">v8.0.0</Badge>
    </div>
  ),
};
