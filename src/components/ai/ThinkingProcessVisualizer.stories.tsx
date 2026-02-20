import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThinkingProcessVisualizer } from './ThinkingProcessVisualizer';

const meta = {
  title: 'AI/ThinkingProcessVisualizer',
  component: ThinkingProcessVisualizer,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ThinkingProcessVisualizer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    isActive: true,
    steps: [
      {
        id: 'step-1',
        step: '캐시 확인',
        description: '기존 캐시에 동일 질의 결과가 있는지 확인합니다',
        status: 'completed',
        duration: 12,
      },
      {
        id: 'step-2',
        step: '의도 분석',
        description: '사용자 질문에서 서버 상태 조회 의도를 감지했습니다',
        status: 'completed',
        duration: 85,
      },
      {
        id: 'step-3',
        step: '복잡도 분석',
        description: '단순 조회 요청 — 로컬 처리 가능',
        status: 'completed',
        duration: 23,
      },
      {
        id: 'step-4',
        step: '라우팅 결정',
        description: '로컬 GCP Function으로 라우팅 (비용 절약 $0)',
        status: 'processing',
      },
    ],
  },
};

export const Completed: Story = {
  args: {
    isActive: false,
    steps: [
      {
        id: 'step-1',
        step: '캐시 확인',
        description: '캐시 미스 — 신규 질의 처리 필요',
        status: 'completed',
        duration: 8,
      },
      {
        id: 'step-2',
        step: '의도 분석',
        description: 'CPU 사용률 이상 탐지 및 원인 분석 요청을 감지했습니다',
        status: 'completed',
        duration: 120,
      },
      {
        id: 'step-3',
        step: '복잡도 분석',
        description: '다중 서버 비교 분석 — Cloud AI 처리 필요',
        status: 'completed',
        duration: 45,
      },
      {
        id: 'step-4',
        step: '라우팅 결정',
        description: 'Cloud Run AI Engine으로 라우팅 (고급 분석)',
        status: 'completed',
        duration: 15,
      },
      {
        id: 'step-5',
        step: 'analyzeServerHealth',
        description: '15개 서버의 CPU, 메모리, 디스크 메트릭 수집 완료',
        status: 'completed',
        duration: 340,
      },
      {
        id: 'step-6',
        step: 'generateInsight',
        description:
          'web-server-03 CPU 과부하 원인: nginx worker 프로세스 폭증',
        status: 'completed',
        duration: 210,
      },
    ],
  },
};
