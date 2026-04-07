import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RealTimeDisplay } from './RealTimeDisplay';

const meta = {
  title: 'Dashboard/RealTimeDisplay',
  component: RealTimeDisplay,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RealTimeDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
