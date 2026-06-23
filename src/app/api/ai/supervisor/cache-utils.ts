/**
 * 🔒 Supervisor Cache Utilities
 *
 * 캐시 제외 조건 감지 및 쿼리 타입 분류
 *
 * @created 2026-01-10 (route.ts에서 분리)
 */

/**
 * 실시간 데이터 요청 키워드
 * 이 키워드가 포함된 쿼리는 캐싱에서 제외됨
 */
const KOREAN_REALTIME_KEYWORDS = [
  '지금',
  '현재',
  '방금',
  '실시간',
  '새로고침',
  '최신',
  '최근',
];

const ENGLISH_REALTIME_KEYWORDS = [
  'now',
  'current',
  'latest',
  'live',
  'refresh',
];

export const REALTIME_KEYWORDS = [
  ...KOREAN_REALTIME_KEYWORDS,
  ...ENGLISH_REALTIME_KEYWORDS,
];

/**
 * 상태 조회 키워드
 * 짧은 TTL 적용
 */
const STATUS_KEYWORDS = [
  '상태',
  'status',
  '서버 상태',
  '시스템 상태',
  'health',
];

/**
 * 캐시 제외 조건 검사
 *
 * @param query - 사용자 쿼리
 * @param messageCount - 메시지 개수
 * @returns 캐시 제외 여부 (true = 캐싱 안 함)
 */
export function shouldSkipCache(query: string, messageCount: number): boolean {
  // 1. 대화 컨텍스트가 있는 경우 (이전 메시지 참조 가능)
  if (messageCount > 1) {
    return true;
  }

  // 2. 실시간 데이터 요청 키워드 검사
  const lowerQuery = query.toLowerCase();
  for (const keyword of KOREAN_REALTIME_KEYWORDS) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  for (const keyword of ENGLISH_REALTIME_KEYWORDS) {
    const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (keywordPattern.test(query)) {
      return true;
    }
  }

  return false;
}

/**
 * 상태 조회 쿼리 여부 확인 (짧은 TTL 적용)
 */
export function isStatusQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return STATUS_KEYWORDS.some((kw) => lowerQuery.includes(kw.toLowerCase()));
}
