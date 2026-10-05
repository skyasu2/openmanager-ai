/**
 * 🔧 시스템 공통 상수 정의
 *
 * 시스템 전반에서 사용되는 공통 상수를 중앙에서 관리
 */

/** 공용 데모 창 길이(분). 동접이 낮고 AI는 일일 한도가 있어 30분보다 UX를 우선한다. */
export const SYSTEM_AUTO_SHUTDOWN_MINUTES = 60;

/** 공용 데모 창(ms). 첫 시작이 창을 열고, 사용자 종료 버튼 없이 TTL로만 닫힌다. */
export const SYSTEM_AUTO_SHUTDOWN_TIME =
  SYSTEM_AUTO_SHUTDOWN_MINUTES * 60 * 1000;

export const SYSTEM_WINDOW_SHUTDOWN_REASON = `${SYSTEM_AUTO_SHUTDOWN_MINUTES}분 자동 종료`;

// 🔄 시스템 상태 갱신 주기
const SYSTEM_STATUS_UPDATE_INTERVAL = 30 * 1000; // 30초

// 🏃 헬스체크 주기
const HEALTH_CHECK_INTERVAL =
  process.env.NODE_ENV === 'development'
    ? 60 * 1000 // 개발: 60초
    : 30 * 1000; // 운영: 30초

// 🔒 보안 설정 (게스트 모드)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 10 * 1000; // 10초

// 📊 데이터 갱신 설정
const AUTO_REFRESH_INTERVAL = {
  MIN: 30 * 1000, // 최소 30초
  MAX: 60 * 1000, // 최대 60초
  DEFAULT: 45 * 1000, // 기본 45초
};

// 🎯 시스템 제한 설정
const SYSTEM_LIMITS = {
  MAX_SERVERS: 30,
  MAX_CONCURRENT_REQUESTS: 10,
  CACHE_TTL: 5 * 60 * 1000, // 5분
};
