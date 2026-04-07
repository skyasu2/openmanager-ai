import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AIAssistantButton } from './AIAssistantButton';

const meta = {
  title: 'Dashboard/AIAssistantButton',
  component: AIAssistantButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AIAssistantButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { isOpen: false, isEnabled: false, onClick: fn() },
};

export const Open: Story = {
  args: { isOpen: true, isEnabled: true, onClick: fn() },
};

export const EnabledClosed: Story = {
  args: { isOpen: false, isEnabled: true, onClick: fn() },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <AIAssistantButton isOpen={false} isEnabled={false} onClick={fn()} />
        <p className="mt-2 text-xs text-gray-500">비활성</p>
      </div>
      <div className="text-center">
        <AIAssistantButton isOpen={false} isEnabled={true} onClick={fn()} />
        <p className="mt-2 text-xs text-gray-500">활성 (닫힘)</p>
      </div>
      <div className="text-center">
        <AIAssistantButton isOpen={true} isEnabled={true} onClick={fn()} />
        <p className="mt-2 text-xs text-gray-500">열림</p>
      </div>
    </div>
  ),
};
