/**
 * 서버 데이터 폴링 정책 (SSOT)
 *
 * 서버 데이터는 KST 기준 10분 슬롯(:00/:10/:20/:30/:40/:50)으로 생성된다.
 * 클라이언트 폴링은 이 슬롯 경계를 기준으로 정렬하여 불필요한 호출을 줄인다.
 */

export const SERVER_DATA_SLOT_MINUTES = 10;
export const SERVER_DATA_INTERVAL_MS = SERVER_DATA_SLOT_MINUTES * 60 * 1000;
export const SERVER_DATA_REFETCH_BUFFER_MS = 2_000;
export const SERVER_DATA_MIN_REFETCH_MS = 60_000;
export const SERVER_DATA_STALE_TIME_MS = SERVER_DATA_INTERVAL_MS - 30_000;
export const SERVER_DATA_GC_TIME_MS = SERVER_DATA_INTERVAL_MS * 2;

/**
 * 다음 KST 10분 슬롯 경계까지 남은 ms를 계산한다.
 * - 경계 직후 API 반영 지연을 고려해 buffer를 더한다.
 * - 클라이언트 시계 오차 보호를 위해 최소값을 둔다.
 */
export function getMsUntilNextServerDataSlot(now = new Date()): number {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const minuteInSlot = kst.getUTCMinutes() % SERVER_DATA_SLOT_MINUTES;
  const secondsInSlot = kst.getUTCSeconds();
  const millisecondsInSlot = kst.getUTCMilliseconds();

  const remainingMs =
    ((SERVER_DATA_SLOT_MINUTES - minuteInSlot) * 60 - secondsInSlot) * 1000 -
    millisecondsInSlot;

  const untilNextBoundary =
    remainingMs <= 0 ? SERVER_DATA_INTERVAL_MS : remainingMs;

  return Math.max(
    untilNextBoundary + SERVER_DATA_REFETCH_BUFFER_MS,
    SERVER_DATA_MIN_REFETCH_MS
  );
}
