/**
 * 공통 에러 타입 정의
 * 순환 의존성 해결을 위해 분리
 */

export interface SafeError {
  message: string;
  stack?: string;
  code?: string;
  name?: string;
  details?: unknown;
  originalError?: unknown;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
