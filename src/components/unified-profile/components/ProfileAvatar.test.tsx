/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileAvatar, UserTypeIcon } from './ProfileAvatar';

vi.mock('lucide-react', () => ({
  Shield: (props: Record<string, unknown>) => (
    <svg data-testid="shield-icon" {...props} />
  ),
  UserCheck: (props: Record<string, unknown>) => (
    <svg data-testid="user-check-icon" {...props} />
  ),
}));

describe('ProfileAvatar accessibility', () => {
  it('marks the type badge as decorative', () => {
    const { container } = render(
      <ProfileAvatar
        userInfo={{
          id: 'guest-1',
          name: '게스트 사용자',
          email: 'guest@test.local',
        }}
        userType="guest"
      />
    );

    const decorativeBadge = container.querySelector('[aria-hidden="true"]');

    expect(decorativeBadge).not.toBeNull();
    expect(decorativeBadge).not.toHaveAttribute('title');
  });

  it('marks provider icons as decorative', () => {
    const { container } = render(<UserTypeIcon userType="guest" />);

    const iconWrapper = container.querySelector('span[aria-hidden="true"]');

    expect(iconWrapper).toHaveAttribute('aria-hidden', 'true');
    expect(iconWrapper).not.toHaveAttribute('title');
  });
});
