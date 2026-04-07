import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import AuthLoadingUI from './AuthLoadingUI';

const meta = {
  title: 'Shared/AuthLoadingUI',
  component: AuthLoadingUI,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    loadingMessage: {
      control: 'text',
      description: '로딩 메시지',
    },
    envLabel: {
      control: 'select',
      options: ['Local', 'Vercel', 'Docker'],
      description: '환경 레이블',
    },
    authError: {
      control: 'text',
      description: '인증 에러 메시지',
    },
  },
} satisfies Meta<typeof AuthLoadingUI>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loadingMessage: '인증 확인 중...',
    envLabel: 'Vercel',
  },
};

export const WithError: Story = {
  args: {
    loadingMessage: '사용자 정보 로드 중...',
    envLabel: 'Local',
    authError: '세션이 만료되었습니다. 다시 로그인해 주세요.',
    onRetry: fn(),
  },
};
