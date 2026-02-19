import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MiniLineChart } from './MiniLineChart';

const meta = {
  title: 'Shared/MiniLineChart',
  component: MiniLineChart,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof MiniLineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData = [30, 45, 38, 52, 48, 60, 55, 70, 65, 72];
const risingData = [20, 25, 30, 35, 42, 50, 58, 68, 75, 85];
const stableData = [50, 48, 52, 49, 51, 50, 48, 52, 50, 51];

export const Default: Story = {
  args: { data: sampleData },
};

export const WithFill: Story = {
  args: { data: sampleData, fill: true, color: '#10b981' },
};

export const Rising: Story = {
  args: { data: risingData, color: '#ef4444', fill: true },
};

export const Stable: Story = {
  args: { data: stableData, color: '#3b82f6' },
};

export const WithLabels: Story = {
  args: { data: sampleData, showLabels: true, color: '#8b5cf6' },
};

export const LargeSize: Story = {
  args: { data: sampleData, width: 200, height: 60, fill: true },
};

export const TimeSeriesData: Story = {
  args: {
    data: [
      { time: '10:00', value: 45 },
      { time: '10:05', value: 52 },
      { time: '10:10', value: 48 },
      { time: '10:15', value: 63 },
      { time: '10:20', value: 58 },
      { time: '10:25', value: 71 },
    ],
    showTooltip: true,
    width: 200,
    height: 50,
  },
};

export const AllColors: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-gray-500">CPU</span>
        <MiniLineChart data={sampleData} color="#3b82f6" fill />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-gray-500">Memory</span>
        <MiniLineChart data={risingData} color="#10b981" fill />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-gray-500">Disk</span>
        <MiniLineChart data={stableData} color="#f59e0b" fill />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-gray-500">Network</span>
        <MiniLineChart data={[10, 80, 20, 70, 30, 60]} color="#8b5cf6" fill />
      </div>
    </div>
  ),
};
