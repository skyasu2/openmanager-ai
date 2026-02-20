import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Activity, Shield } from 'lucide-react';
import { fn } from 'storybook/test';
import type { StarterPrompt } from './WelcomePromptCards';
import WelcomePromptCards from './WelcomePromptCards';

const meta = {
  title: 'AI/WelcomePromptCards',
  component: WelcomePromptCards,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WelcomePromptCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onPromptClick: fn(),
  },
};

const customPrompts: StarterPrompt[] = [
  {
    icon: Activity,
    title: '네트워크 트래픽 분석',
    prompt: '현재 네트워크 트래픽 패턴을 분석해줘',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    icon: Shield,
    title: '보안 점검',
    prompt: '최근 비정상 접근 시도를 조회해줘',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
];

export const CustomPrompts: Story = {
  args: {
    onPromptClick: fn(),
    prompts: customPrompts,
  },
};
