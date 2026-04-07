import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Loader2, Play } from 'lucide-react';
import { fn } from 'storybook/test';

import { DashboardSection } from './DashboardSection';
import { LoginPrompt } from './LoginPrompt';
import { SystemStartSection } from './SystemStartSection';

// ─── Meta ───────────────────────────────────────────────────

const meta = {
  title: 'Pages/Landing',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 text-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────

/** 시스템 대기 상태 - 시작 버튼 활성화 */
export const SystemIdle: Story = {
  render: () => (
    <SystemStartSection
      isMounted={true}
      systemStartCountdown={0}
      isSystemStarting={false}
      isSystemStarted={false}
      isSystemRunning={false}
      buttonConfig={{
        text: '시스템 시작',
        icon: <Play className="h-5 w-5" />,
        className:
          'border-blue-500/50 bg-blue-600 text-white hover:bg-blue-700',
        disabled: false,
      }}
      statusInfo={{
        color: 'text-blue-200',
        message: '시스템을 시작하려면 버튼을 클릭하세요',
        showEscHint: false,
      }}
      onSystemToggle={fn()}
    />
  ),
};

/** 시스템 시작 중 - 카운트다운 진행 */
export const SystemStarting: Story = {
  render: () => (
    <SystemStartSection
      isMounted={true}
      systemStartCountdown={3}
      isSystemStarting={true}
      isSystemStarted={false}
      isSystemRunning={false}
      buttonConfig={{
        text: '시작 중... 3',
        icon: <Loader2 className="h-5 w-5 animate-spin" />,
        className:
          'border-yellow-500/50 bg-yellow-600/80 text-white cursor-wait',
        disabled: true,
      }}
      statusInfo={{
        color: 'text-yellow-200',
        message: 'AI 엔진을 준비하고 있습니다...',
        showEscHint: true,
      }}
      onSystemToggle={fn()}
    />
  ),
};

/** 시스템 가동 중 - 대시보드 이동 버튼 */
export const SystemRunning: Story = {
  render: () => (
    <DashboardSection
      canAccessDashboard={true}
      onNavigateDashboard={fn()}
      onStopSystem={fn()}
    />
  ),
};

/** 비인증 상태 - 로그인 유도 */
export const Unauthenticated: Story = {
  render: () => (
    <LoginPrompt
      isMounted={true}
      guestModeMessage="게스트 모드에서는 읽기 전용 기능만 사용 가능합니다."
    />
  ),
};
