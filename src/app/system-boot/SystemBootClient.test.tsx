/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  consumeSystemBootIntent: vi.fn(),
  clearChatHistory: vi.fn(),
  clearMessages: vi.fn(),
  triggerAIWarmup: vi.fn().mockResolvedValue(undefined),
  debugLog: vi.fn(),
  isSystemStarted: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
}));

vi.mock('@/components/landing/MouseSpotlight', () => ({
  MouseSpotlight: () =>
    React.createElement('canvas', { 'data-testid': 'mouse-spotlight' }),
}));

vi.mock('@/hooks/ai/utils/chat-history-storage', () => ({
  clearChatHistory: mocks.clearChatHistory,
}));

vi.mock('@/lib/system/system-boot-intent', () => ({
  consumeSystemBootIntent: mocks.consumeSystemBootIntent,
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: {
    getState: () => ({
      clearMessages: mocks.clearMessages,
    }),
  },
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: () => ({
    isSystemStarted: mocks.isSystemStarted,
  }),
}));

vi.mock('@/utils/ai-warmup', () => ({
  triggerAIWarmup: mocks.triggerAIWarmup,
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: mocks.debugLog,
  },
}));

import SystemBootClient from './SystemBootClient';

describe('SystemBootClient boot intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSystemStarted = false;
    mocks.consumeSystemBootIntent.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('이미 실행 중인 시스템에 직접 접근하면 부팅 화면을 스킵하고 대시보드로 이동한다', async () => {
    mocks.isSystemStarted = true;
    mocks.consumeSystemBootIntent.mockReturnValue(false);

    render(React.createElement(SystemBootClient));

    await waitFor(() => {
      expect(mocks.routerReplace).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.queryByText('OpenManager')).not.toBeInTheDocument();
    expect(mocks.clearChatHistory).not.toHaveBeenCalled();
  });

  it('시작 버튼에서 온 fresh boot intent가 있으면 이미 실행 중이어도 부팅 화면을 표시한다', async () => {
    mocks.isSystemStarted = true;
    mocks.consumeSystemBootIntent.mockReturnValue(true);

    render(React.createElement(SystemBootClient));

    expect(await screen.findByText('OpenManager')).toBeInTheDocument();
    expect(screen.getByText('시스템 초기화')).toBeInTheDocument();
    expect(mocks.routerReplace).not.toHaveBeenCalledWith('/dashboard');
    expect(mocks.clearChatHistory).toHaveBeenCalledTimes(1);
    expect(mocks.clearMessages).toHaveBeenCalledTimes(1);
    expect(mocks.triggerAIWarmup).toHaveBeenCalledWith('system-boot');
  });
});
