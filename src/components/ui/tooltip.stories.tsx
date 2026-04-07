import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">마우스를 올려보세요</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>서버 상태: 정상</p>
      </TooltipContent>
    </Tooltip>
  ),
};

export const Positions: Story = {
  render: () => (
    <div className="flex gap-8 p-10">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">
            위
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Top</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">
            아래
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Bottom</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">
            왼쪽
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Left</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">
            오른쪽
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Right</TooltipContent>
      </Tooltip>
    </div>
  ),
};
