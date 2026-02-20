import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AnalysisBasisBadge from './AnalysisBasisBadge';

const meta = {
  title: 'AI/AnalysisBasisBadge',
  component: AnalysisBasisBadge,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalysisBasisBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    basis: {
      dataSource: '15개 서버 실시간 OTel 메트릭',
      engine: 'Cloud Run AI (Gemini 2.5 Flash)',
      serverCount: 15,
      timeRange: '최근 1시간',
    },
  },
};

export const WithRAG: Story = {
  args: {
    basis: {
      dataSource: '15개 서버 실시간 데이터',
      engine: 'Cloud Run AI (Gemini 2.5 Flash)',
      ragUsed: true,
      serverCount: 15,
      timeRange: '최근 24시간',
      confidence: 92,
      ragSources: [
        {
          title: 'CPU 임계치 초과 장애 대응 가이드',
          similarity: 0.94,
          sourceType: 'knowledge-base',
          category: 'incident-response',
        },
        {
          title: 'Linux 서버 메모리 누수 분석',
          similarity: 0.82,
          sourceType: 'knowledge-base',
          category: 'troubleshooting',
        },
        {
          title: 'Kubernetes Pod 리소스 제한 설정',
          similarity: 0.71,
          sourceType: 'web',
          url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
        },
      ],
    },
  },
};

export const HighConfidence: Story = {
  args: {
    basis: {
      dataSource: '3개 서버 실시간 데이터',
      engine: 'Streaming Fallback',
      confidence: 98,
      serverCount: 3,
      timeRange: '최근 5분',
    },
  },
};
