import type { SafeError } from './types/error-types';

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
  if (error === null || error === undefined) {
    return {
      message: 'Unknown error (null/undefined)',
      code: 'NULL_ERROR',
      name: 'NullError',
      originalError: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'Error without message',
      stack: error.stack,
      code: error.name || 'Error',
      name: error.name || 'Error',
      originalError: error,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error || 'Empty error message',
      code: 'STRING_ERROR',
      name: 'StringError',
      originalError: error,
    };
  }

  if (typeof error === 'number') {
    return {
      message: `Error code: ${error}`,
      code: error.toString(),
      name: 'NumberError',
      originalError: error,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

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

  if (typeof error === 'symbol') {
    return {
      message: `Symbol error: ${error.toString()}`,
      code: 'SYMBOL_ERROR',
      name: 'SymbolError',
      originalError: error,
    };
  }

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
