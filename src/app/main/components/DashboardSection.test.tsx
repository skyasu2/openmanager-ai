/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardSection } from './DashboardSection';

describe('DashboardSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('대시보드 진입 버튼을 명확한 텍스트 라벨로 렌더링한다', () => {
    const onNavigateDashboard = vi.fn();

    render(
      <DashboardSection
        canAccessDashboard
        onNavigateDashboard={onNavigateDashboard}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '대시보드 열기' }));

    expect(onNavigateDashboard).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('클릭하세요')).not.toBeInTheDocument();
  });

  it('시스템 종료는 확인된 경우에만 실행한다', () => {
    const onStopSystem = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <DashboardSection
        canAccessDashboard
        onNavigateDashboard={vi.fn()}
        onStopSystem={onStopSystem}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '시스템 종료하기' }));

    expect(confirmSpy).toHaveBeenCalledWith('시스템을 종료하시겠습니까?');
    expect(onStopSystem).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '시스템 종료하기' }));

    expect(onStopSystem).toHaveBeenCalledTimes(1);
  });
});
