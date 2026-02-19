import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { Activity, Server, Settings } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

const meta = {
  title: 'Shared/CollapsibleCard',
  component: CollapsibleCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsibleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: {
    title: '서버 상세',
    subtitle: '3대의 서버가 모니터링 중입니다',
    isExpanded: true,
    onToggle: fn(),
    children: (
      <div className="space-y-2 text-sm text-gray-600">
        <p>web-server-01: CPU 45%, Memory 62%</p>
        <p>api-server-01: CPU 32%, Memory 58%</p>
        <p>db-primary: CPU 28%, Memory 71%</p>
      </div>
    ),
  },
};

export const Collapsed: Story = {
  args: {
    title: '서버 상세',
    subtitle: '3대의 서버가 모니터링 중입니다',
    isExpanded: false,
    onToggle: fn(),
    children: <p>이 콘텐츠는 접혀 있습니다.</p>,
  },
};

export const WithIcon: Story = {
  args: {
    title: '메트릭 요약',
    icon: <Activity className="h-5 w-5 text-blue-500" />,
    isExpanded: true,
    onToggle: fn(),
    children: (
      <p className="text-sm text-gray-600">평균 CPU: 42% | 평균 Memory: 65%</p>
    ),
  },
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-4">
      <CollapsibleCard
        title="Default"
        variant="default"
        isExpanded
        onToggle={fn()}
        icon={<Server className="h-5 w-5 text-gray-500" />}
      >
        <p className="text-sm text-gray-600">기본 스타일 카드</p>
      </CollapsibleCard>
      <CollapsibleCard
        title="Bordered"
        variant="bordered"
        isExpanded
        onToggle={fn()}
        icon={<Activity className="h-5 w-5 text-blue-500" />}
      >
        <p className="text-sm text-gray-600">테두리 스타일 카드</p>
      </CollapsibleCard>
      <CollapsibleCard
        title="Elevated"
        variant="elevated"
        isExpanded
        onToggle={fn()}
        icon={<Settings className="h-5 w-5 text-purple-500" />}
      >
        <p className="text-sm text-gray-600">그림자 강조 카드</p>
      </CollapsibleCard>
    </div>
  ),
};
