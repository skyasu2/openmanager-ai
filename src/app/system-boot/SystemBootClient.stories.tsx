import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, mocked } from 'storybook/test';

import { useAISidebarStore } from '../../stores/useAISidebarStore';
import { useUnifiedAdminStore } from '../../stores/useUnifiedAdminStore';

import SystemBootClient from './SystemBootClient';

const meta = {
  title: 'Pages/SystemBoot',
  component: SystemBootClient,
  parameters: {
    layout: 'fullscreen',
    nextjs: { navigation: { pathname: '/system-boot' } },
  },
  beforeEach() {
    // 시스템 미시작 상태로 부팅 애니메이션 실행
    mocked(useUnifiedAdminStore).mockReturnValue({
      isSystemStarted: false,
    } as never);

    // useAISidebarStore.getState().clearMessages() 지원
    Object.assign(mocked(useAISidebarStore), {
      getState: fn(() => ({ clearMessages: fn() })),
    });
  },
} satisfies Meta<typeof SystemBootClient>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────

/** 부팅 애니메이션 자연 실행 (0% → 100%) */
export const BootRunning: Story = {};

/** 부팅 중간 지점 (~50% 진행) */
export const MidProgress: Story = {
  play: async () => {
    // 애니메이션이 ~50% 진행될 때까지 대기 (BOOT_STAGES 기준 약 2.5초)
    await new Promise((r) => setTimeout(r, 2500));
  },
};

/** 부팅 완료 후 대시보드 전환 대기 상태 */
export const BootCompleted: Story = {
  play: async () => {
    // 전체 부팅 스테이지 완료 대기 (~5.5초)
    await new Promise((r) => setTimeout(r, 5500));
  },
};
