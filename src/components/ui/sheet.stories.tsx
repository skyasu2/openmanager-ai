import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const meta = {
  title: 'UI/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">오른쪽 패널 열기</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>서버 설정</SheetTitle>
          <SheetDescription>서버 세부 설정을 변경합니다.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">서버 이름</Label>
            <Input id="name" defaultValue="web-server-01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host">호스트</Label>
            <Input id="host" defaultValue="192.168.1.100" />
          </div>
        </div>
        <SheetFooter>
          <Button>저장</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const OpenAndClose: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>시트 열기</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>테스트 시트</SheetTitle>
          <SheetDescription>시트 열림 테스트</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '시트 열기' }));
    await expect(screen.getByRole('dialog')).toBeInTheDocument();
  },
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">왼쪽 패널 열기</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>내비게이션</SheetTitle>
          <SheetDescription>메뉴를 선택하세요.</SheetDescription>
        </SheetHeader>
        <nav className="space-y-2 py-4">
          <Button variant="ghost" className="w-full justify-start">
            대시보드
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            서버 목록
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            알림 설정
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};
