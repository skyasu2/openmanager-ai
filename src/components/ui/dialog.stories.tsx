import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">다이얼로그 열기</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>서버 상세 정보</DialogTitle>
          <DialogDescription>
            선택한 서버의 상세 모니터링 데이터입니다.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-600">
            CPU: 45% | Memory: 62% | Disk: 38%
          </p>
        </div>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>서버 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 서버 등록</DialogTitle>
          <DialogDescription>
            모니터링할 서버 정보를 입력하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dialog-name">서버 이름</Label>
            <Input id="dialog-name" placeholder="web-server-01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dialog-host">호스트 주소</Label>
            <Input id="dialog-host" placeholder="192.168.1.100" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">취소</Button>
          <Button>등록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const OpenAndClose: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>열기</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>테스트</DialogTitle>
        <DialogDescription>다이얼로그 열림 테스트</DialogDescription>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '열기' }));
    await expect(screen.getByRole('dialog')).toBeInTheDocument();
  },
};

export const Confirm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">서버 삭제</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>서버를 삭제하시겠습니까?</DialogTitle>
          <DialogDescription>
            이 작업은 되돌릴 수 없습니다. 모든 모니터링 데이터가 삭제됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">취소</Button>
          <Button variant="destructive">삭제</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
