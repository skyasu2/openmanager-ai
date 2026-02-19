import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>서버 상태</CardTitle>
        <CardDescription>현재 모니터링 중인 서버 정보</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">CPU: 45% | Memory: 62%</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>알림 설정</CardTitle>
        <CardDescription>서버 임계치 알림을 설정합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">CPU 임계치: 80%</p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline">취소</Button>
        <Button>저장</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>서버 추가</CardTitle>
        <CardDescription>모니터링할 서버를 등록합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">서버 이름</Label>
          <Input id="name" placeholder="web-server-01" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="host">호스트</Label>
          <Input id="host" placeholder="192.168.1.100" />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">등록</Button>
      </CardFooter>
    </Card>
  ),
};

export const Minimal: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardContent className="pt-6">
        <p className="text-sm text-gray-600">헤더 없는 간결한 카드</p>
      </CardContent>
    </Card>
  ),
};
