export type DashboardEmptyStateMode = 'none' | 'filtered-empty' | 'no-data';

export interface ResolveDashboardEmptyStateParams {
  visibleServersCount: number;
  totalServersCount: number;
  hasActiveFilter: boolean;
}

/**
 * 빈 상태를 구분한다.
 * - filtered-empty: 데이터는 있으나 필터 결과가 0건
 * - no-data: 실제 데이터 자체가 없음
 */
export function resolveDashboardEmptyState({
  visibleServersCount,
  totalServersCount,
  hasActiveFilter,
}: ResolveDashboardEmptyStateParams): DashboardEmptyStateMode {
  if (visibleServersCount > 0) return 'none';
  if (totalServersCount === 0) return 'no-data';
  return hasActiveFilter ? 'filtered-empty' : 'no-data';
}
