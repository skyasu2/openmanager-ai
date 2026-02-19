import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta = {
  title: 'UI/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">필터 설정</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">서버 필터</h4>
          <p className="text-sm text-muted-foreground">
            표시할 서버 조건을 설정합니다.
          </p>
          <div className="space-y-2">
            <Label htmlFor="min-cpu">최소 CPU (%)</Label>
            <Input id="min-cpu" type="number" defaultValue="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-cpu">최대 CPU (%)</Label>
            <Input id="max-cpu" type="number" defaultValue="100" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const Info: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          ?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p className="text-sm">
          서버 상태는 5초마다 갱신됩니다. AI 분석은 1분 간격으로 실행됩니다.
        </p>
      </PopoverContent>
    </Popover>
  ),
};
