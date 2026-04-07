import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AIInsightBadge } from './AIInsightBadge';

const meta = {
  title: 'Shared/AIInsightBadge',
  component: AIInsightBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AIInsightBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stable: Story = {
  args: { cpu: 30, memory: 45 },
};

export const Rising: Story = {
  args: {
    cpu: 50,
    memory: 60,
    historyData: [
      { cpu: 30, memory: 40 },
      { cpu: 35, memory: 45 },
      { cpu: 40, memory: 50 },
      { cpu: 45, memory: 55 },
      { cpu: 50, memory: 60 },
    ],
  },
};

export const Unusual: Story = {
  args: {
    cpu: 80,
    memory: 85,
    historyData: [
      { cpu: 60, memory: 65 },
      { cpu: 65, memory: 70 },
      { cpu: 70, memory: 75 },
      { cpu: 75, memory: 80 },
      { cpu: 80, memory: 85 },
    ],
  },
};

export const Critical: Story = {
  args: { cpu: 95, memory: 92 },
};

export const Declining: Story = {
  args: {
    cpu: 30,
    memory: 35,
    historyData: [
      { cpu: 60, memory: 65 },
      { cpu: 55, memory: 58 },
      { cpu: 45, memory: 48 },
      { cpu: 38, memory: 40 },
      { cpu: 30, memory: 35 },
    ],
  },
};

export const AllInsightTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <AIInsightBadge cpu={30} memory={45} />
      <AIInsightBadge
        cpu={50}
        memory={60}
        historyData={[
          { cpu: 30, memory: 40 },
          { cpu: 35, memory: 45 },
          { cpu: 40, memory: 50 },
          { cpu: 45, memory: 55 },
          { cpu: 50, memory: 60 },
        ]}
      />
      <AIInsightBadge
        cpu={80}
        memory={85}
        historyData={[
          { cpu: 60, memory: 65 },
          { cpu: 65, memory: 70 },
          { cpu: 70, memory: 75 },
          { cpu: 75, memory: 80 },
          { cpu: 80, memory: 85 },
        ]}
      />
      <AIInsightBadge cpu={95} memory={92} />
      <AIInsightBadge
        cpu={30}
        memory={35}
        historyData={[
          { cpu: 60, memory: 65 },
          { cpu: 55, memory: 58 },
          { cpu: 45, memory: 48 },
          { cpu: 38, memory: 40 },
          { cpu: 30, memory: 35 },
        ]}
      />
    </div>
  ),
};
