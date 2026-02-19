import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="서버 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="web-01">web-server-01</SelectItem>
        <SelectItem value="web-02">web-server-02</SelectItem>
        <SelectItem value="api-01">api-server-01</SelectItem>
        <SelectItem value="db-01">db-server-01</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="서버 그룹 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>웹 서버</SelectLabel>
          <SelectItem value="web-01">web-server-01</SelectItem>
          <SelectItem value="web-02">web-server-02</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>데이터베이스</SelectLabel>
          <SelectItem value="db-01">db-primary</SelectItem>
          <SelectItem value="db-02">db-replica</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-[240px] space-y-2">
      <Label htmlFor="region">리전</Label>
      <Select>
        <SelectTrigger id="region">
          <SelectValue placeholder="리전 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ap-northeast-1">Asia (Seoul)</SelectItem>
          <SelectItem value="us-east-1">US East</SelectItem>
          <SelectItem value="eu-west-1">EU West</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="비활성" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">옵션 1</SelectItem>
      </SelectContent>
    </Select>
  ),
};
