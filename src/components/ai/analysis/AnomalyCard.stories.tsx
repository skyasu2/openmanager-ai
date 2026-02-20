import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AnomalyCard } from './AnomalyCard';

const meta = {
  title: 'AI/Analysis/AnomalyCard',
  component: AnomalyCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnomalyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Anomaly: Story = {
  args: {
    metric: 'cpu',
    data: {
      isAnomaly: true,
      severity: 'high',
      confidence: 0.92,
      currentValue: 94.3,
      threshold: {
        upper: 85,
        lower: 10,
      },
    },
  },
};

export const Normal: Story = {
  args: {
    metric: 'memory',
    data: {
      isAnomaly: false,
      severity: 'low',
      confidence: 0.88,
      currentValue: 62.1,
      threshold: {
        upper: 80,
        lower: 15,
      },
    },
  },
};
