/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoLogoutWarning } from './AutoLogoutWarning';

describe('AutoLogoutWarning', () => {
  it('경고 상태가 아니면 렌더링하지 않는다', () => {
    render(
      <AutoLogoutWarning
        remainingTime={30}
        isWarning={false}
        onExtendSession={vi.fn()}
        onLogoutNow={vi.fn()}
      />
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('alertdialog semantics와 초기 포커스를 제공해야 한다', () => {
    render(
      <AutoLogoutWarning
        remainingTime={75}
        isWarning={true}
        onExtendSession={vi.fn()}
        onLogoutNow={vi.fn()}
      />
    );

    const dialog = screen.getByRole('alertdialog', {
      name: '자동 로그아웃 경고',
    });
    const extendButton = screen.getByRole('button', { name: '세션 연장' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(extendButton).toHaveFocus();
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('backdrop 클릭은 세션 연장으로 연결되고 음수 카운트다운은 0으로 보정한다', () => {
    const onExtendSession = vi.fn();

    render(
      <AutoLogoutWarning
        remainingTime={-5}
        isWarning={true}
        onExtendSession={onExtendSession}
        onLogoutNow={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '배경 클릭으로 세션 연장' })
    );

    expect(onExtendSession).toHaveBeenCalled();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });
});
