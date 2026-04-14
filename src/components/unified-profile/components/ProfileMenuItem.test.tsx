/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { LogOut } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileMenuItem } from './ProfileMenuItem';

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('ProfileMenuItem', () => {
  it('runs shared activation flow for keyboard interactions', () => {
    const action = vi.fn();
    const onClick = vi.fn();

    render(
      <ProfileMenuItem
        id="logout"
        label="로그아웃"
        icon={LogOut}
        action={action}
        visible
        onClick={onClick}
      />
    );

    fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'Enter' });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
