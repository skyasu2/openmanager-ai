/**
 * 🧪 Vitest Test Setup Configuration
 * OpenManager AI - 기본 테스트 환경 설정
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// React 18 호환성 설정은 직접 구현
if (typeof window !== 'undefined') {
  // @ts-expect-error
  window.React = require('react');
}

// 환경변수 설정 - 타입 안전성을 위한 개선된 방법
const setEnvVar = (key: string, value: string) => {
  try {
    process.env[key] = value;
  } catch {
    // readonly인 경우 Object.defineProperty 사용
    Object.defineProperty(process.env, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
};

// NODE_ENV 설정
if (!process.env.NODE_ENV) {
  setEnvVar('NODE_ENV', 'test');
}

// 테스트용 환경변수 설정
const testEnvVars: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_PASSWORD: '',
  // Cloud Run AI uses GCP IAM auth, no API key needed
  UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  NEXT_PUBLIC_APP_NAME: 'OpenManager AI',
  NEXT_PUBLIC_APP_VERSION: '8.0.0',
  VITEST: 'true',
  FORCE_MOCK_REDIS: 'true',
  FORCE_MOCK_CLOUD_RUN_AI: 'true',
  TEST_ISOLATION: 'true',
  DISABLE_HEALTH_CHECK: 'true',
  FORCE_EXIT: 'true',
  CI: 'true',
};

// 환경변수 설정
Object.entries(testEnvVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    setEnvVar(key, value);
  }
});

// 🚨 강제 종료 타이머 설정 (30초 후 강제 종료)
let forceExitTimer: NodeJS.Timeout | null = null;

// 전역 테스트 설정
beforeAll(async () => {
  // React act 환경 설정
  if (typeof globalThis !== 'undefined') {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  }

  // 콘솔 경고 억제 (테스트 환경)
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args.join(' ');
    if (
      message.includes('ReactDOMTestUtils.act') ||
      message.includes('React.act') ||
      message.includes('act(...)') ||
      message.includes('ONNX Runtime')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // 🚨 강제 종료 타이머 시작
  if (process.env.FORCE_EXIT === 'true') {
    forceExitTimer = setTimeout(() => {
      console.log('🚨 테스트 강제 종료 - 30초 타임아웃');
      process.exit(0);
    }, 30000);
  }
});

// 각 테스트 전 설정
beforeEach(() => {
  // Vitest 타이머 설정 (조건부)
  if (!process.env.CI) {
    vi.useFakeTimers();
  }

  // 고정된 시간 설정 (테스트 일관성)
  const mockDate = new Date('2024-06-19T12:26:40.000Z');
  if (!process.env.CI) {
    vi.setSystemTime(mockDate);
  }
});

// 각 테스트 후 정리
afterEach(async () => {
  // React Testing Library 정리
  cleanup();

  // Vitest 타이머 정리 (조건부)
  if (!process.env.CI) {
    vi.useRealTimers();
  }

  // 모든 모의 함수 정리
  vi.clearAllMocks();
  vi.clearAllTimers();

  // 🧹 추가 정리 작업
  if (typeof window !== 'undefined') {
    // 이벤트 리스너 정리
    window.removeEventListener = vi.fn();
    window.addEventListener = vi.fn();
  }

  // 비동기 작업 대기 (최대 100ms)
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// 전체 테스트 종료 후 정리
afterAll(async () => {
  // React act 환경 정리
  if (typeof globalThis !== 'undefined') {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  }

  // 🚨 강제 종료 타이머 정리
  if (forceExitTimer) {
    clearTimeout(forceExitTimer);
    forceExitTimer = null;
  }

  // 🧹 최종 정리 작업
  vi.clearAllMocks();
  vi.clearAllTimers();

  // 모든 비동기 작업 완료 대기
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 🚨 CI 환경에서 강제 종료
  if (process.env.CI === 'true' || process.env.FORCE_EXIT === 'true') {
    setTimeout(() => {
      console.log('✅ 테스트 완료 - 프로세스 종료');
      process.exit(0);
    }, 1000);
  }
});

// 글로벌 fetch mock 설정
global.fetch = vi.fn();

// ResizeObserver mock
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver mock
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// sessionStorage mock
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// URL.createObjectURL mock
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// 🚨 강화된 에러 핸들링 및 프로세스 종료 관리
if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // CI 환경에서는 즉시 종료하지 않고 로그만 출력
    if (process.env.CI !== 'true') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (process.env.CI !== 'true') {
      process.exit(1);
    }
  });

  // 🚨 SIGINT/SIGTERM 핸들러 (Ctrl+C 등)
  process.on('SIGINT', () => {
    console.log('🚨 테스트 중단됨 (SIGINT)');
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🚨 테스트 중단됨 (SIGTERM)');
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
    }
    process.exit(0);
  });
}

// 테스트 환경 확인
console.log('🧪 Vitest test environment initialized');
console.log('🌍 Node environment:', process.env.NODE_ENV);
console.log('🚨 Force exit enabled:', process.env.FORCE_EXIT);
console.log('🔄 CI mode:', process.env.CI);
