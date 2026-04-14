/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardHeader from './DashboardHeader';

vi.mock('@/components/shared/OpenManagerLogo', () => ({
  OpenManagerLogo: () => <div data-testid="openmanager-logo" />,
}));

vi.mock('@/components/shared/UnifiedProfileHeader', () => ({
  default: () => <div data-testid="unified-profile-header" />,
}));

vi.mock('./AIAssistantButton', () => ({
  AIAssistantButton: () => <button type="button">AI Assistant</button>,
}));

vi.mock('./AILoginRequiredModal', () => ({
  AILoginRequiredModal: () => null,
}));

vi.mock('./RealTimeDisplay', () => ({
  RealTimeDisplay: () => <div data-testid="realtime-display" />,
}));

vi.mock('./SessionCountdown', () => ({
  SessionCountdown: () => <div data-testid="session-countdown" />,
}));

vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({
    isGitHubAuthenticated: true,
    isPinAuthenticated: false,
  }),
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: (selector: (state: object) => unknown) =>
    selector({
      isOpen: false,
      setOpen: vi.fn(),
    }),
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: object) => unknown) =>
    selector({
      aiAgent: { isEnabled: true },
    }),
}));

vi.mock('@/utils/debug', () => ({
  default: { log: vi.fn() },
}));

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('DashboardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('데스크톱에서는 실시간 정보와 세션 카운트다운을 한 번만 마운트해야 한다', () => {
    mockMatchMedia(true);

    render(<DashboardHeader />);

    expect(screen.getAllByTestId('realtime-display')).toHaveLength(1);
    expect(screen.getAllByTestId('session-countdown')).toHaveLength(1);
  });

  it('모바일에서는 실시간 정보와 세션 카운트다운을 한 번만 마운트해야 한다', () => {
    mockMatchMedia(false);

    render(<DashboardHeader />);

    expect(screen.getAllByTestId('realtime-display')).toHaveLength(1);
    expect(screen.getAllByTestId('session-countdown')).toHaveLength(1);
  });
});
