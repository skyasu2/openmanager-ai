import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: '텍스트를 입력하세요' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="server">서버 이름</Label>
      <Input id="server" placeholder="web-server-01" />
    </div>
  ),
};

export const Password: Story = {
  args: { type: 'password', placeholder: '비밀번호' },
};

export const Search: Story = {
  args: { type: 'search', placeholder: '서버 검색...' },
};

export const Disabled: Story = {
  args: { disabled: true, value: '수정 불가' },
};

export const WithValue: Story = {
  args: { defaultValue: '192.168.1.100' },
};

export const AllTypes: Story = {
  render: () => (
    <div className="w-[300px] space-y-3">
      <Input placeholder="텍스트" />
      <Input type="password" placeholder="비밀번호" />
      <Input type="search" placeholder="검색..." />
      <Input type="number" placeholder="숫자" />
      <Input type="email" placeholder="email@example.com" />
      <Input disabled value="비활성" />
    </div>
  ),
};
