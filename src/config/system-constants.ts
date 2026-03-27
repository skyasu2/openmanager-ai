/**
 * 🔧 시스템 공통 상수 정의
 *
 * 시스템 전반에서 사용되는 공통 상수를 중앙에서 관리
 */

// 🕐 시스템 자동 종료 시간 (30분)
export const SYSTEM_AUTO_SHUTDOWN_TIME = 30 * 60 * 1000; // 30분

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
