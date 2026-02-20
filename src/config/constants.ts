/**
 * System Constants Configuration
 *
 * 🔧 모든 하드코딩된 상수들을 중앙에서 관리
 */

// 🌐 네트워크 설정
export const NETWORK = {
  PORTS: {
    DEFAULT_HTTP: 80,
    DEFAULT_HTTPS: 443,
    REDIS_DEFAULT: 6379,
    PROMETHEUS_DEFAULT: 9090,
    CUSTOM_API_DEFAULT: 8080,
    NODE_EXPORTER: 9100,
    GRAFANA_DEFAULT: 3000,
  },

  TIMEOUTS: {
    API_REQUEST: 10000, // 10초
    HEALTH_CHECK: 5000, // 5초
    WEBSOCKET: 30000, // 30초
    DATABASE: 15000, // 15초
  },

  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MS: 1000, // 1초
    EXPONENTIAL_BASE: 2,
  },
} as const;

// ⏰ 시간 관련 상수
export const TIME = {
  MILLISECONDS: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
  },

  SECONDS: {
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
  },

  // 세션 및 캐시 TTL
  TTL: {
    SESSION: 24 * 60 * 60, // 24시간 (초)
    CACHE_SHORT: 5 * 60, // 5분 (초)
    CACHE_MEDIUM: 30 * 60, // 30분 (초)
    CACHE_LONG: 60 * 60, // 1시간 (초)
    REDIS_DEFAULT: 300, // 5분 (초)
  },

  // 업무 시간 설정
  BUSINESS_HOURS: {
    START: 9, // 오전 9시
    END: 18, // 오후 6시
    LUNCH_START: 12,
    LUNCH_END: 13,
  },
} as const;

// 📊 데이터 제한
export const LIMITS = {
  // 페이지네이션
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 1,
  },

  // 문자열 길이
  STRING: {
    MAX_URL_LENGTH: 2048,
    MAX_HEADER_SIZE: 8192,
    MAX_QUERY_LENGTH: 1000,
    MAX_MESSAGE_LENGTH: 5000,
  },

  // 파일 크기
  FILE: {
    MAX_PAYLOAD_SIZE: 1024 * 1024, // 1MB
    MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB
  },

  // 컬렉션 크기 (경연대회 최적화)
  COLLECTION: {
    MAX_HISTORY_LENGTH: 50,
    MAX_SESSIONS: 10,
    MAX_LOGS: 5000, // 경연대회 최적화: 절반으로 축소
    MAX_METRICS_POINTS: 500, // 경연대회 최적화: 절반으로 축소
    MAX_ALERTS_PER_HOUR: 25, // 경연대회 최적화: 절반으로 축소
    MAX_SERVERS: 15, // 🎯 8개 → 15개로 증가 (중앙 설정과 통일)
  },

  // 성능 관련
  PERFORMANCE: {
    MAX_ITERATIONS: 100,
    SLOW_QUERY_MS: 3000,
    MEMORY_WARNING_PERCENT: 80,
    CPU_WARNING_PERCENT: 70,
  },
} as const;

// 🖥️ 화면 크기 브레이크포인트
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
  LARGE: 1536,
} as const;

// 🎨 UI 상수
export const UI = {
  ANIMATION: {
    DURATION_FAST: 150, // 0.15초
    DURATION_NORMAL: 300, // 0.3초
    DURATION_SLOW: 500, // 0.5초
    DELAY_INCREMENT: 100, // 0.1초씩 증가
  },

  COLORS: {
    STATUS: {
      SUCCESS: '#10B981', // green-500
      WARNING: '#F59E0B', // amber-500
      ERROR: '#EF4444', // red-500
      INFO: '#3B82F6', // blue-500
    },
  },

  SIZES: {
    BUTTON_MIN_HEIGHT: 44, // 터치 친화적 최소 크기
    MODAL_MIN_WIDTH: 300,
    MODAL_MAX_WIDTH: 800,
    SIDEBAR_WIDTH: 384, // 24rem
  },
} as const;

// 🔐 보안 설정
export const SECURITY = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: false,
  },

  SESSION: {
    MAX_AGE_HOURS: 24,
    REFRESH_THRESHOLD_HOURS: 2,
    MAX_CONCURRENT_SESSIONS: 5,
  },

  RATE_LIMIT: {
    API_REQUESTS_PER_MINUTE: 60,
    LOGIN_ATTEMPTS_PER_HOUR: 5,
    PASSWORD_RESET_PER_DAY: 3,
  },

  // API 인증 설정
  API: {
    MAX_KEY_LENGTH: 256, // DoS 방지를 위한 API 키 최대 길이
  },

  // 보안 로거 설정
  LOGGER: {
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1시간 (밀리초)
    SAMPLE_WINDOW_MS: 60 * 1000, // 1분 (밀리초)
    MAX_LOG_SIZE: 1000, // 최대 IP 추적 개수
  },
} as const;

// 📈 모니터링 설정
export const MONITORING = {
  INTERVALS: {
    HEALTH_CHECK_MS: 60000, // 30초 → 60초 (Vercel 최적화)
    METRICS_COLLECTION_MS: 120000, // 1분 → 2분 (Vercel 최적화)
    LOG_ROTATION_MS: 3600000, // 1시간
    CLEANUP_MS: 86400000, // 24시간
  },

  RETENTION: {
    METRICS_DAYS: 30,
    LOGS_DAYS: 7,
    ALERTS_DAYS: 90,
    SESSIONS_HOURS: 24,
  },

  BATCH_SIZES: {
    METRICS_BATCH: 5, // 경연대회 최적화: Redis 명령어 그룹핑 (10→5로 축소)
    LOGS_BATCH: 10, // 경연대회 최적화: 무료 티어 한도 내 (15→10으로 축소)
    ALERTS_BATCH: 3, // 경연대회 최적화: 메모리 효율성 (5→3으로 축소)
  },
} as const;

// 🌍 환경별 설정
export const ENVIRONMENT = {
  DEVELOPMENT: {
    LOG_LEVEL: 'debug',
    ENABLE_MOCK_DATA: true,
    CACHE_DISABLED: true,
  },

  PRODUCTION: {
    LOG_LEVEL: 'error',
    ENABLE_MOCK_DATA: false,
    CACHE_DISABLED: false,
  },

  TEST: {
    LOG_LEVEL: 'silent',
    ENABLE_MOCK_DATA: true,
    CACHE_DISABLED: true,
  },
} as const;

// 🔌 MCP 서버 설정 (SSOT - registry-core.yaml 기준)
// 참조: config/ai/registry-core.yaml mcp-servers.development
export const MCP_SERVERS = {
  // 활성화된 MCP 서버 목록 (8/8, 2026-02-14 동기화)
  ACTIVE: [
    'vercel', // 배포 관리
    'supabase', // DB 관리
    'context7', // 라이브러리 문서
    'playwright', // E2E 테스트
    'next-devtools', // Next.js 런타임 진단
    'github', // 저장소 관리
    'sequential-thinking', // 복잡한 추론
    'stitch', // Google Stitch AI UI Design (2026-01-27)
    'storybook', // 컴포넌트 문서·스토리 조회 (2026-02-19)
  ] as const,

  // 제거된 MCP 서버 (2026-02-14 업데이트)
  REMOVED: [
    'filesystem', // Claude Code 내장 도구와 중복
    'memory', // Claude Code auto-memory로 대체
    'time', // 사용 빈도 낮음
    'shadcn-ui', // Context7로 대체
    'figma', // 미사용 (6회/월 Starter 제한)
    'brave-search', // built-in WebSearch로 대체
    'tavily', // built-in WebSearch로 대체
    'serena', // Claude Code built-in 도구(Read/Edit/Grep/Glob)로 대체
  ] as const,

  // 서버 수
  TOTAL_ACTIVE: 9,
} as const;

// MCP 서버 목록 타입 (타입 안전성)
export type ActiveMcpServer = (typeof MCP_SERVERS.ACTIVE)[number];
