/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_POLICY_COPY } from '@/lib/auth/login-policy-copy';
import { GuestRestrictionModal } from './GuestRestrictionModal';

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

describe('GuestRestrictionModal', () => {
  afterEach(() => {
    routerPush.mockClear();
  });

  it('로그인 필요 사유를 표시하고 로그인 페이지로 이동한다', () => {
    const onClose = vi.fn();

    render(<GuestRestrictionModal open onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('로그인 필요')).toBeInTheDocument();
    expect(
      screen.getByText(LOGIN_POLICY_COPY.systemStartGateDescription)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '로그인 페이지로 이동' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/login');
  });

  it('게스트 시스템 시작 차단 사유를 별도 문구로 표시한다', () => {
    render(
      <GuestRestrictionModal
        open
        onClose={vi.fn()}
        reason="guest-start-blocked"
      />
    );

    expect(screen.getByText('게스트 모드 제한')).toBeInTheDocument();
    expect(
      screen.getByText(LOGIN_POLICY_COPY.guestSystemStartBlocked)
    ).toBeInTheDocument();
  });
});
