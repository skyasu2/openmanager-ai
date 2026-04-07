import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { RestoreConversationBanner } from './RestoreConversationBanner';

const meta = {
  title: 'AISidebar/RestoreConversationBanner',
  component: RestoreConversationBanner,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg">
        <Story />
      </div>
    ),
  ],
  args: {
    onRestore: fn(),
    onNewSession: fn(),
  },
} satisfies Meta<typeof RestoreConversationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    messageCount: 12,
  },
};

export const FewMessages: Story = {
  args: {
    messageCount: 3,
  },
};
