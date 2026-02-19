import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Progress } from './progress';

const meta = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60 },
};

export const Empty: Story = {
  args: { value: 0 },
};

export const Half: Story = {
  args: { value: 50 },
};

export const Full: Story = {
  args: { value: 100 },
};

export const AllLevels: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm text-gray-600">CPU: 25%</p>
        <Progress value={25} />
      </div>
      <div>
        <p className="mb-1 text-sm text-gray-600">Memory: 60%</p>
        <Progress value={60} />
      </div>
      <div>
        <p className="mb-1 text-sm text-gray-600">Disk: 85%</p>
        <Progress value={85} />
      </div>
      <div>
        <p className="mb-1 text-sm text-gray-600">Network: 95%</p>
        <Progress value={95} />
      </div>
    </div>
  ),
};
