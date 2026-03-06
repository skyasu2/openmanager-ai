/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmergencyBanner } from './EmergencyBanner';

const isEmergencyMode = vi.fn();
const getEmergencyMessage = vi.fn();

vi.mock('@/lib/emergency-mode', () => ({
  emergencyMode: {
    isEmergencyMode,
    getEmergencyMessage,
  },
}));

describe('EmergencyBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEmergencyMessage.mockReturnValue('비상 모드 메시지');
  });

  it('emergency mode가 아니면 렌더링하지 않는다', () => {
    isEmergencyMode.mockReturnValue(false);

    const { container } = render(<EmergencyBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('emergency mode면 경고 메시지를 표시한다', () => {
    isEmergencyMode.mockReturnValue(true);

    render(<EmergencyBanner />);

    expect(screen.getByText('비상 모드 메시지')).toBeInTheDocument();
  });
});
