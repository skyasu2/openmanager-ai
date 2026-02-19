import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';

const meta = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[400px]">
      <Info className="h-4 w-4" />
      <AlertTitle>안내</AlertTitle>
      <AlertDescription>시스템 점검이 예정되어 있습니다.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-[400px]">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>오류 발생</AlertTitle>
      <AlertDescription>
        서버 연결에 실패했습니다. 네트워크 상태를 확인하세요.
      </AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert className="w-[400px] border-green-500/50 text-green-700 [&>svg]:text-green-700">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>완료</AlertTitle>
      <AlertDescription>모든 서버가 정상 동작 중입니다.</AlertDescription>
    </Alert>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="w-[400px] space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>정보</AlertTitle>
        <AlertDescription>일반 안내 메시지</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>에러</AlertTitle>
        <AlertDescription>에러 메시지</AlertDescription>
      </Alert>
      <Alert className="border-green-500/50 text-green-700 [&>svg]:text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>성공</AlertTitle>
        <AlertDescription>성공 메시지</AlertDescription>
      </Alert>
    </div>
  ),
};
