import { describe, expect, it } from 'vitest';
import { resolveDashboardEmptyState } from './dashboard-empty-state';

describe('resolveDashboardEmptyState', () => {
  it('서버가 보이면 빈 상태가 아니다', () => {
    const result = resolveDashboardEmptyState({
      visibleServersCount: 3,
      totalServersCount: 10,
      hasActiveFilter: true,
    });

    expect(result).toBe('none');
  });

  it('전체 서버가 없으면 no-data를 반환한다', () => {
    const result = resolveDashboardEmptyState({
      visibleServersCount: 0,
      totalServersCount: 0,
      hasActiveFilter: false,
    });

    expect(result).toBe('no-data');
  });

  it('필터가 활성화되고 결과가 없으면 filtered-empty를 반환한다', () => {
    const result = resolveDashboardEmptyState({
      visibleServersCount: 0,
      totalServersCount: 15,
      hasActiveFilter: true,
    });

    expect(result).toBe('filtered-empty');
  });
});
