import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InsightSection } from './InsightSection';

const meta = {
  title: 'AI/Analysis/InsightSection',
  component: InsightSection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InsightSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithInsights: Story = {
  args: {
    data: {
      success: true,
      patterns: ['spike_pattern', 'memory_leak', 'periodic_load'],
      detectedIntent: 'performance_analysis',
      analysisResults: [
        {
          pattern: 'CPU 스파이크 패턴',
          confidence: 0.89,
          insights:
            '14:00~15:00 시간대에 주기적 CPU 사용량 급증이 감지되었습니다. 배치 작업 스케줄과 일치하는 패턴입니다.',
        },
        {
          pattern: '메모리 누수 의심',
          confidence: 0.76,
          insights:
            '지난 6시간 동안 메모리 사용량이 점진적으로 증가하고 있습니다. 서비스 재시작 후 해제되는 패턴으로 보아 메모리 누수가 의심됩니다.',
        },
        {
          pattern: '주기적 부하 패턴',
          confidence: 0.92,
          insights:
            '매일 오전 9시~10시에 트래픽 급증이 발생합니다. 업무 시작 시간과 맞물린 정상적인 패턴으로 판단됩니다.',
        },
      ],
      _mode: 'full-analysis',
    },
  },
};

export const Empty: Story = {
  args: {
    data: {
      success: true,
      patterns: [],
      detectedIntent: 'status_check',
      analysisResults: [],
      _mode: 'quick-check',
    },
  },
};
