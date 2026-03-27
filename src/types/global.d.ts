/**
 * 전역 객체 타입 확장
 * Node.js global 객체에 커스텀 속성들의 타입을 정의
 */

// 시스템 요청 제한 관련 타입
interface StatusRequestCount {
  count: number;
  resetTime: number;
}

// 마지막 상태 체크 관련 타입
interface LastStatusCheck {
  [userId: string]: number;
}

// 무료 티어 캐시 관련 타입
interface FreeTierCache {
  [key: string]: unknown;
}

// Polyfill 관련 타입
interface DocumentMock {
  createElement: () => Record<string, unknown>;
  getElementById: () => null;
  querySelector: () => null;
  querySelectorAll: () => unknown[];
  addEventListener: () => void;
  removeEventListener: () => void;
}

interface NavigatorMock {
  userAgent: string;
  platform: string;
  language: string;
}

interface LocationMock {
  href: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  hostname: string;
  port: string;
  protocol: string;
}

interface StorageMock {
  getItem: () => null;
  setItem: () => void;
  removeItem: () => void;
  clear: () => void;
  length: number;
  key: () => null;
}

declare global {
  // Node.js global 객체 확장
  namespace NodeJS {
    interface Global {
      statusRequestCount?: StatusRequestCount;
      lastStatusCheck?: LastStatusCheck;
      freeTierCache?: FreeTierCache;
      // Polyfill 속성들
      self?: typeof globalThis;
      window?: typeof globalThis;
      document?: DocumentMock;
      navigator?: NavigatorMock;
      location?: LocationMock;
      localStorage?: StorageMock;
      sessionStorage?: StorageMock;
    }
  }

  // 글로벌 스코프에서 직접 사용할 수 있도록 확장
  var statusRequestCount: StatusRequestCount | undefined;
  var lastStatusCheck: LastStatusCheck | undefined;
  var freeTierCache: FreeTierCache | undefined;

  // Window 객체 확장 (브라우저 환경)
  interface Window {
    self?: Window;
  }

  // GlobalThis 확장
  interface GlobalThis {
    self?: typeof globalThis;
  }
}

export {};
