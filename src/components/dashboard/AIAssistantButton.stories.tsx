import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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
  tags: ['interaction-test'],
  args: { isOpen: false, isEnabled: true, onClick: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step(
      'enabled button exposes the open action and calls handler',
      async () => {
        const button = canvas.getByRole('button', {
          name: 'AI 어시스턴트 열기',
        });

        await waitFor(() =>
          expect(button).toHaveAttribute('aria-pressed', 'false')
        );
        await userEvent.click(button);
        await expect(args.onClick).toHaveBeenCalled();
      }
    );
  },
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
