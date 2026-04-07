import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { Switch } from './switch';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="ai-mode" />
      <Label htmlFor="ai-mode">AI 모드 활성화</Label>
    </div>
  ),
};

export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch id="s1" />
        <Label htmlFor="s1">기본</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="s2" defaultChecked />
        <Label htmlFor="s2">활성</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="s3" disabled />
        <Label htmlFor="s3">비활성</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="s4" disabled defaultChecked />
        <Label htmlFor="s4">비활성 (켜짐)</Label>
      </div>
    </div>
  ),
};
