/**
 * 서버/클라이언트 일관된 시간 포맷팅 유틸리티
 *
 * suppressHydrationWarning과 함께 사용하여 hydration mismatch 방지
 * - 모든 함수가 명시적 locale('ko-KR')을 사용
 * - null/invalid 입력에 대해 안전한 fallback 반환
 */

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '--:--:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR');
}
