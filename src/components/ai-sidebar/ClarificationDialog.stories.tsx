import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ClarificationDialog } from './ClarificationDialog';

const meta = {
  title: 'AISidebar/ClarificationDialog',
  component: ClarificationDialog,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    clarification: {
      description: '명확화 요청 데이터 (원본 쿼리, 옵션 목록, 이유)',
    },
  },
} satisfies Meta<typeof ClarificationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    clarification: {
      originalQuery: '서버 상태 알려줘',
      reason: '어떤 서버의 상태를 확인하고 싶으신지 구체적으로 알려주세요.',
      options: [
        {
          id: 'opt-1',
          text: '전체 서버 요약',
          suggestedQuery: '전체 서버 상태 요약해줘',
          category: 'scope',
        },
        {
          id: 'opt-2',
          text: '웹 서버만',
          suggestedQuery: '웹 서버 상태 알려줘',
          category: 'specificity',
        },
        {
          id: 'opt-3',
          text: '최근 1시간',
          suggestedQuery: '최근 1시간 동안 서버 상태 변화 알려줘',
          category: 'timerange',
        },
        {
          id: 'opt-4',
          text: '직접 입력',
          suggestedQuery: '',
          category: 'custom',
        },
      ],
    },
    onSelectOption: fn(),
    onSubmitCustom: fn(),
    onSkip: fn(),
    onDismiss: fn(),
  },
};

export const WithCustomInput: Story = {
  args: {
    clarification: {
      originalQuery: 'CPU 높은 서버',
      reason:
        'CPU 사용률 기준과 조회 범위를 지정하면 더 정확한 결과를 드릴 수 있어요.',
      options: [
        {
          id: 'opt-1',
          text: 'CPU 80% 이상',
          suggestedQuery: 'CPU 사용률 80% 이상인 서버 목록',
          category: 'specificity',
        },
        {
          id: 'opt-2',
          text: '최근 30분',
          suggestedQuery: '최근 30분간 CPU 높은 서버 알려줘',
          category: 'timerange',
        },
        {
          id: 'opt-3',
          text: 'TOP 5 서버',
          suggestedQuery: 'CPU 사용률 TOP 5 서버',
          category: 'scope',
        },
        {
          id: 'opt-4',
          text: '직접 입력',
          suggestedQuery: '',
          category: 'custom',
        },
      ],
    },
    onSelectOption: fn(),
    onSubmitCustom: fn(),
    onSkip: fn(),
    onDismiss: fn(),
  },
};
