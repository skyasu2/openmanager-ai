interface ServerDashboardPerformanceStats {
  getAverageRenderTime: () => number;
  getRenderCount: () => number;
}

export function ServerDashboardDevStats({
  displayedServerCount,
  performanceStats,
  sortedServerCount,
  totalServerCount,
}: {
  displayedServerCount: number;
  performanceStats: ServerDashboardPerformanceStats;
  sortedServerCount: number;
  totalServerCount: number;
}) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-xs rounded-lg border border-gray-300 bg-white/90 p-3 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-2 font-medium text-gray-800">📊 성능 통계</div>
      <div className="space-y-1 text-gray-600">
        <div>렌더링: {performanceStats.getRenderCount()}회</div>
        <div>
          평균 시간: {performanceStats.getAverageRenderTime().toFixed(1)}ms
        </div>
        <div>서버 수: {sortedServerCount}개</div>
        <div>
          표시: {displayedServerCount}/{totalServerCount}
        </div>
      </div>
    </div>
  );
}
