import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import UnifiedCircularGauge from './UnifiedCircularGauge';

const meta = {
  title: 'Shared/UnifiedCircularGauge',
  component: UnifiedCircularGauge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    type: { control: 'radio', options: ['cpu', 'memory', 'disk', 'network'] },
    variant: { control: 'select', options: ['card', 'modal', 'modal-3d'] },
  },
} satisfies Meta<typeof UnifiedCircularGauge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: { value: 45, label: 'CPU', type: 'cpu', variant: 'modal' },
};

export const Warning: Story = {
  args: { value: 78, label: 'Memory', type: 'memory', variant: 'modal' },
};

export const Critical: Story = {
  args: { value: 92, label: 'Disk', type: 'disk', variant: 'modal' },
};

export const CardVariant: Story = {
  render: () => (
    <div className="flex gap-4">
      <UnifiedCircularGauge value={35} label="CPU" type="cpu" variant="card" />
      <UnifiedCircularGauge
        value={65}
        label="MEM"
        type="memory"
        variant="card"
      />
      <UnifiedCircularGauge
        value={82}
        label="Disk"
        type="disk"
        variant="card"
      />
      <UnifiedCircularGauge
        value={20}
        label="Net"
        type="network"
        variant="card"
      />
    </div>
  ),
};

export const Modal3D: Story = {
  args: { value: 68, label: 'CPU Usage', type: 'cpu', variant: 'modal-3d' },
};

export const AllMetricTypes: Story = {
  render: () => (
    <div className="flex gap-8">
      <UnifiedCircularGauge value={45} label="CPU" type="cpu" variant="modal" />
      <UnifiedCircularGauge
        value={72}
        label="Memory"
        type="memory"
        variant="modal"
      />
      <UnifiedCircularGauge
        value={88}
        label="Disk"
        type="disk"
        variant="modal"
      />
      <UnifiedCircularGauge
        value={30}
        label="Network"
        type="network"
        variant="modal"
      />
    </div>
  ),
};
