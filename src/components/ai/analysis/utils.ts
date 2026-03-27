/**
 * Analysis Components - Utility Functions
 */

// 임계값 대비 현재값 위치 계산
export function calculatePosition(
  value: number,
  lower: number,
  upper: number
): number {
  const range = upper - lower;
  if (range <= 0) return 50;
  const position = ((value - lower) / range) * 100;
  return Math.max(0, Math.min(100, position));
}

// 시간대 패턴 힌트 생성
export function getTimePatternHint(): { label: string; color: string } {
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend) {
    return { label: '주말', color: 'bg-purple-100 text-purple-700' };
  }
  if (hour >= 9 && hour < 12) {
    return { label: '오전 업무', color: 'bg-blue-100 text-blue-700' };
  }
  if (hour >= 12 && hour < 14) {
    return { label: '점심시간', color: 'bg-yellow-100 text-yellow-700' };
  }
  if (hour >= 14 && hour < 18) {
    return { label: '오후 피크', color: 'bg-orange-100 text-orange-700' };
  }
  if (hour >= 18 && hour < 22) {
    return { label: '저녁', color: 'bg-indigo-100 text-indigo-700' };
  }
  return { label: '야간', color: 'bg-gray-100 text-gray-700' };
}
