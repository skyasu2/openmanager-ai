/**
 * 🛡️ OpenManager v5 - 완전한 안전 에러 처리 시스템
 *
 * 모든 error.message 접근을 안전하게 처리하여
 * "Cannot read properties of undefined (reading 'message')" 에러를 완전 근절
 */

import { logger } from '@/lib/logging';
import type { SafeError } from './types/error-types';

/**
 * Window 타입 확장 (에러 핸들러 전용)
 */
interface ErrorHandlerWindow extends Window {
  __openManagerErrorHandlerSetup?: boolean;
  emergencyComplete?: () => void;
  debugSafeError?: (error: unknown) => SafeError;
  testErrorHandler?: () => void;
}

declare const window: ErrorHandlerWindow;

/**
 * 에러 타입 분류
 */
export type ErrorType =
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'SERVER_ERROR'
  | 'LOADING_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * 🔧 모든 error를 안전한 SafeError로 변환
 * null, undefined, 모든 타입의 에러를 안전하게 처리
 */
export function createSafeError(error: unknown): SafeError {
  // null 또는 undefined 처리
  if (error === null || error === undefined) {
    return {
      message: 'Unknown error (null/undefined)',
      code: 'NULL_ERROR',
      name: 'NullError',
      originalError: error,
    };
  }

  // Error 인스턴스 처리
  if (error instanceof Error) {
    return {
      message: error.message || 'Error without message',
      stack: error.stack,
      code: error.name || 'Error',
      name: error.name || 'Error',
      originalError: error,
    };
  }

  // 문자열 처리
  if (typeof error === 'string') {
    return {
      message: error || 'Empty error message',
      code: 'STRING_ERROR',
      name: 'StringError',
      originalError: error,
    };
  }

  // 숫자 처리
  if (typeof error === 'number') {
    return {
      message: `Error code: ${error}`,
      code: error.toString(),
      name: 'NumberError',
      originalError: error,
    };
  }

  // 객체 처리 (message 속성 포함)
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // message 속성이 있는 경우
    if ('message' in errorObj) {
      return {
        message:
          typeof errorObj.message === 'string'
            ? errorObj.message || 'Object error without message'
            : (() => {
                try {
                  return JSON.stringify(
                    errorObj.message ?? 'Invalid message type'
                  );
                } catch {
                  const msg = errorObj.message;
                  return typeof msg === 'string' ? msg : 'Invalid message type';
                }
              })(),
        stack: errorObj.stack as string | undefined,
        code: (errorObj.code || errorObj.name || 'ObjectError') as string,
        name: (errorObj.name || 'ObjectError') as string,
        details: errorObj,
        originalError: error,
      };
    }

    // toString이 가능한 객체
    try {
      const stringified = JSON.stringify(errorObj);
      return {
        message: `Object error: ${stringified}`,
        code: 'OBJECT_ERROR',
        name: 'ObjectError',
        details: errorObj,
        originalError: error,
      };
    } catch {
      return {
        message: 'Object error (not serializable)',
        code: 'NON_SERIALIZABLE_ERROR',
        name: 'NonSerializableError',
        originalError: error,
      };
    }
  }

  // Symbol 처리
  if (typeof error === 'symbol') {
    return {
      message: `Symbol error: ${error.toString()}`,
      code: 'SYMBOL_ERROR',
      name: 'SymbolError',
      originalError: error,
    };
  }

  // 기타 모든 경우
  try {
    return {
      message:
        typeof error === 'object' && error !== null && 'message' in error
          ? (() => {
              const msg = (error as { message: unknown }).message;
              if (typeof msg === 'string') return msg;
              try {
                return JSON.stringify(msg ?? '');
              } catch {
                return typeof msg === 'string' ? msg : 'Unknown message';
              }
            })()
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return typeof error === 'string' ? error : 'Unknown error';
              }
            })(),
      code: 'UNKNOWN_ERROR',
      name: 'UnknownError',
      originalError: error,
    };
  } catch {
    return {
      message: 'Error occurred (could not convert to string)',
      code: 'CONVERSION_ERROR',
      name: 'ConversionError',
      originalError: error,
    };
  }
}

/**
 * 🔍 에러 타입 자동 분류
 */
export function classifyErrorType(safeError: SafeError): ErrorType {
  const message = safeError.message.toLowerCase();

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'NETWORK_ERROR';
  }

  if (message.includes('timeout') || message.includes('시간 초과')) {
    return 'TIMEOUT_ERROR';
  }

  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('인증')
  ) {
    return 'AUTHENTICATION_ERROR';
  }

  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('권한')
  ) {
    return 'PERMISSION_ERROR';
  }

  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('찾을 수 없')
  ) {
    return 'NOT_FOUND_ERROR';
  }

  if (
    message.includes('500') ||
    message.includes('server') ||
    message.includes('서버')
  ) {
    return 'SERVER_ERROR';
  }

  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('유효하지')
  ) {
    return 'VALIDATION_ERROR';
  }

  if (
    message.includes('loading') ||
    message.includes('boot') ||
    message.includes('로딩')
  ) {
    return 'LOADING_ERROR';
  }

  if (message.includes('api') || safeError.code?.includes('API')) {
    return 'API_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * 🚨 안전한 콘솔 에러 로깅
 */
export function safeErrorLog(
  prefix: string,
  error: unknown,
  includeStack = false
): SafeError {
  const safeError = createSafeError(error);
  const errorType = classifyErrorType(safeError);

  // 콘솔 로깅
  logger.error(`${prefix}:`, safeError.message);
  logger.error(`↳ Type: ${errorType}`, `Code: ${safeError.code || 'NONE'}`);

  if (includeStack && safeError.stack) {
    logger.error('↳ Stack:', safeError.stack);
  }

  // 개발 환경에서는 원본 에러도 출력
  if (process.env.NODE_ENV === 'development' && safeError.originalError) {
    logger.error('↳ Original:', safeError.originalError);
  }

  return safeError;
}

/**
 * 🔄 안전한 에러 메시지 추출 (간단 버전)
 */
export function safeErrorMessage(
  error: unknown,
  fallback = '알 수 없는 오류가 발생했습니다'
): string {
  // null 또는 undefined인 경우 fallback을 우선적으로 반환
  if (error === null || error === undefined) {
    return fallback;
  }

  try {
    return createSafeError(error).message;
  } catch {
    return fallback;
  }
}

/**
 * 🎯 로딩 관련 에러 감지
 */
export function isLoadingRelatedError(error: unknown): boolean {
  const safeError = createSafeError(error);
  const message = safeError.message.toLowerCase();

  return (
    message.includes('loading') ||
    message.includes('boot') ||
    message.includes('complete') ||
    message.includes('oncomplete') ||
    message.includes('로딩') ||
    message.includes('완료') ||
    message.includes('uptime') ||
    message.includes('includes is not a function') ||
    message.includes('cannot read property') ||
    classifyErrorType(safeError) === 'LOADING_ERROR'
  );
}

/**
 * 🛡️ 타입 안전성 에러 감지
 */
export function isTypeSafetyError(error: unknown): boolean {
  const safeError = createSafeError(error);
  const message = safeError.message.toLowerCase();

  return (
    message.includes('includes is not a function') ||
    message.includes('cannot read property') ||
    message.includes('cannot read properties') ||
    message.includes('undefined is not a function') ||
    message.includes('null is not a function') ||
    message.includes('trim is not a function') ||
    message.includes('split is not a function') ||
    message.includes('map is not a function') ||
    message.includes('filter is not a function') ||
    message.includes('is not a function') ||
    message.includes('of undefined') ||
    message.includes('of null')
  );
}

/**
 * 🔧 자동 복구 가능한 에러인지 확인
 */
export function isAutoRecoverableError(error: unknown): boolean {
  const safeError = createSafeError(error);
  const message = safeError.message.toLowerCase();

  // 타입 안전성 에러는 자동 복구 가능
  if (isTypeSafetyError(error)) return true;

  // 네트워크 에러는 자동 복구 가능
  if (message.includes('network') || message.includes('fetch')) return true;

  // 연결 실패는 자동 복구 가능
  if (message.includes('connection failed') || message.includes('timeout'))
    return true;

  // 일시적인 서버 에러는 자동 복구 가능
  if (
    message.includes('500') ||
    message.includes('503') ||
    message.includes('server error')
  )
    return true;

  return false;
}

/**
 * 🛡️ 전역 에러 핸들러 설정
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  // 기존 핸들러 제거 (중복 방지)
  window.__openManagerErrorHandlerSetup = true;

  // Unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    const safeError = safeErrorLog('🚨 Global Error', event.error, true);

    // 로딩 관련 에러면 자동 복구 시도
    if (isLoadingRelatedError(event.error)) {
      logger.info('🚀 로딩 관련 에러 감지 - 자동 복구 시도');
      setTimeout(() => {
        window.emergencyComplete?.();
      }, 1000);
    }

    // 중요한 에러만 사용자에게 알림
    if (
      safeError.code &&
      !['LOADING_ERROR', 'NETWORK_ERROR'].includes(classifyErrorType(safeError))
    ) {
      // toast 알림 등 구현 가능
    }
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    safeErrorLog('🚨 Unhandled Promise Rejection', event.reason, true);

    // 로딩 관련 Promise 에러 자동 복구
    if (isLoadingRelatedError(event.reason)) {
      logger.info('🚀 Promise 로딩 에러 감지 - 자동 복구 시도');
      setTimeout(() => {
        window.emergencyComplete?.();
      }, 1000);
    }

    // 기본 에러 표시 방지 (이미 우리가 처리했으므로)
    event.preventDefault();
  });

  // 디버깅용 전역 함수 등록
  window.debugSafeError = (error: unknown) => {
    return createSafeError(error);
  };

  window.testErrorHandler = () => {
    try {
      throw new Error('Test error for handler verification');
    } catch (e) {
      logger.info('테스트 에러 처리 결과:', createSafeError(e));
    }
  };

  logger.info('🛡️ 전역 에러 핸들러 설정 완료');
}

/**
 * 🔄 API 호출 안전 래퍼
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  errorContext = 'API 호출',
  fallbackValue?: T
): Promise<{ success: boolean; data?: T; error?: SafeError }> {
  try {
    const data = await apiCall();
    return { success: true, data };
  } catch (error) {
    const safeError = createSafeError(error);
    logger.error(`❌ ${errorContext} 실패`, error);

    // 로딩 화면에서 API 에러가 발생해도 진행할 수 있도록
    if (typeof window !== 'undefined' && isLoadingRelatedError(error)) {
      setTimeout(() => {
        window.emergencyComplete?.();
      }, 2000);
    }

    return {
      success: false,
      error: safeError,
      ...(fallbackValue !== undefined && { data: fallbackValue }),
    };
  }
}

/**
 * 🎭 에러 복구 전략
 */
export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: unknown;
  onRetry?: (attempt: number, error: SafeError) => void;
  shouldRetry?: (error: SafeError) => boolean;
}

export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  options: ErrorRecoveryOptions = {}
): Promise<{
  success: boolean;
  data?: T;
  error?: SafeError;
  attempts: number;
}> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    fallbackValue,
    onRetry,
    shouldRetry = () => true, // 기본적으로 모든 에러에 대해 재시도
  } = options;

  let attempts = 0;
  let lastError: SafeError | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      attempts++;
      const data = await operation();
      return { success: true, data, attempts };
    } catch (error) {
      lastError = createSafeError(error);

      if (i < maxRetries - 1 && shouldRetry(lastError)) {
        logger.error(`🔄 재시도 ${i + 1}/${maxRetries}`, error);
        onRetry?.(i + 2, lastError); // 다음 시도 번호 전달

        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      } else {
        // 재시도하지 않는 경우에도 onRetry 호출하지 않음
        break;
      }
    }
  }

  const result: {
    success: boolean;
    data?: T;
    error: SafeError;
    attempts: number;
  } = {
    success: false,
    error:
      lastError ||
      createSafeError(new Error('Operation failed without retries')),
    attempts,
  };

  if (fallbackValue !== undefined) {
    result.data = fallbackValue as T;
  }

  logger.error('❌ 모든 재시도 실패', result.error);
  return result;
}

/**
 * 🎯 React 컴포넌트용 에러 바운더리 헬퍼
 */
export function createErrorBoundaryInfo(error: unknown, errorInfo?: unknown) {
  const safeError = createSafeError(error);

  // React ErrorInfo 타입 추출
  const errorInfoObj = errorInfo as { componentStack?: string } | undefined;

  return {
    error: safeError,
    errorType: classifyErrorType(safeError),
    timestamp: new Date().toISOString(),
    userAgent:
      typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
    url: typeof window !== 'undefined' ? window.location.href : 'SSR',
    componentStack: errorInfoObj?.componentStack,
    isLoadingError: isLoadingRelatedError(error),
  };
}
