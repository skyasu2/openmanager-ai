/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSection } from './DashboardSection';

describe('DashboardSection', () => {
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

    render(
      <DashboardSection
        canAccessDashboard
        onNavigateDashboard={vi.fn()}
        onStopSystem={onStopSystem}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '시스템 종료하기' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('시스템 종료')).toBeInTheDocument();
    expect(onStopSystem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onStopSystem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '시스템 종료하기' }));
    fireEvent.click(screen.getByRole('button', { name: '종료 확인' }));

    expect(onStopSystem).toHaveBeenCalledTimes(1);
  });
});
