/**
 * 세션 상태 타입 정의
 *
 * AI 채팅 세션 관리를 위한 타입들
 * Note: HITL(Human-in-the-Loop) 기능은 v4.1에서 제거됨 - 모든 AI 기능이 사용자 요청 기반
 */

// ============================================================================
// 세션 상태 타입
// ============================================================================

/**
 * 세션 상태 (메시지 제한 관리용)
 */
export interface SessionState {
  count: number;
  remaining: number;
  isWarning: boolean;
  isLimitReached: boolean;
}

/**
 * 세션 제한 상수
 *
 * @updated 2026-01-03 - 보안 강화 (100 → 50)
 * - 악의적 사용/실수로 인한 폭주 방지
 * - 25 대화쌍 (50 메시지)으로 제한
 * - WARNING_THRESHOLD는 40개 (80%)에서 경고
 */
export const SESSION_LIMITS = {
  MESSAGE_LIMIT: 50,
  WARNING_THRESHOLD: 40,
} as const;

/**
 * 대화 이어가기는 같은 브라우저 탭의 인증 세션 동안만 유지한다.
 * 탭 종료·로그아웃 시 리셋. localStorage/DB 장기 기억은 쓰지 않는다.
 */
export const EPHEMERAL_CHAT_STORAGE_KEYS = {
  HISTORY: 'openmanager-chat-history',
  SESSION_ID: 'openmanager-ai-session-id',
} as const;
