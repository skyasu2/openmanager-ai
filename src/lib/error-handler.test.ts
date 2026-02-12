import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logging';
import {
  classifyErrorType,
  createErrorBoundaryInfo,
  createSafeError,
  isAutoRecoverableError,
  isLoadingRelatedError,
  isTypeSafetyError,
  safeApiCall,
  safeErrorLog,
  safeErrorMessage,
  withErrorRecovery,
} from './error-handler';

describe('Error Handler', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSafeError', () => {
    it('null과 undefined를 안전하게 처리한다', () => {
      const nullError = createSafeError(null);
      expect(nullError.message).toBe('Unknown error (null/undefined)');
      expect(nullError.code).toBe('NULL_ERROR');
      expect(nullError.originalError).toBe(null);

      const undefinedError = createSafeError(undefined);
      expect(undefinedError.message).toBe('Unknown error (null/undefined)');
      expect(undefinedError.code).toBe('NULL_ERROR');
      expect(undefinedError.originalError).toBe(undefined);
    });

    it('Error 인스턴스를 올바르게 처리한다', () => {
      const originalError = new Error('Test error message');
      originalError.name = 'TestError';

      const safeError = createSafeError(originalError);

      expect(safeError.message).toBe('Test error message');
      expect(safeError.name).toBe('TestError');
      expect(safeError.code).toBe('TestError');
      expect(safeError.stack).toBeDefined();
      expect(safeError.originalError).toBe(originalError);
    });

    it('메시지가 없는 Error를 처리한다', () => {
      const errorWithoutMessage = new Error('');
      errorWithoutMessage.message = '';

      const safeError = createSafeError(errorWithoutMessage);

      expect(safeError.message).toBe('Error without message');
    });

    it('문자열 에러를 처리한다', () => {
      const stringError = 'Something went wrong';
      const safeError = createSafeError(stringError);

      expect(safeError.message).toBe('Something went wrong');
      expect(safeError.code).toBe('STRING_ERROR');
      expect(safeError.name).toBe('StringError');
      expect(safeError.originalError).toBe(stringError);
    });

    it('빈 문자열을 처리한다', () => {
      const safeError = createSafeError('');

      expect(safeError.message).toBe('Empty error message');
      expect(safeError.code).toBe('STRING_ERROR');
    });

    it('숫자 에러를 처리한다', () => {
      const numberError = 404;
      const safeError = createSafeError(numberError);

      expect(safeError.message).toBe('Error code: 404');
      expect(safeError.code).toBe('404');
      expect(safeError.name).toBe('NumberError');
      expect(safeError.originalError).toBe(numberError);
    });

    it('message 속성이 있는 객체를 처리한다', () => {
      const objectError = {
        message: 'Custom object error',
        code: 'CUSTOM_ERROR',
        stack: 'fake stack trace',
      };

      const safeError = createSafeError(objectError);

      expect(safeError.message).toBe('Custom object error');
      expect(safeError.code).toBe('CUSTOM_ERROR');
      expect(safeError.stack).toBe('fake stack trace');
      expect(safeError.details).toBe(objectError);
    });

    it('message가 빈 문자열인 객체를 처리한다', () => {
      const objectError = { message: '' };
      const safeError = createSafeError(objectError);

      expect(safeError.message).toBe('Object error without message');
    });

    it('message가 문자열이 아닌 객체를 처리한다', () => {
      const objectError = { message: 123 };
      const safeError = createSafeError(objectError);

      expect(safeError.message).toBe('123');
    });

    it('직렬화 가능한 객체를 처리한다', () => {
      const objectError = { status: 500, data: 'server error' };
      const safeError = createSafeError(objectError);

      expect(safeError.message).toContain('Object error:');
      expect(safeError.message).toContain('status');
      expect(safeError.code).toBe('OBJECT_ERROR');
      expect(safeError.details).toBe(objectError);
    });

    it('순환 참조가 있는 객체를 처리한다', () => {
      const circularError: Record<string, unknown> = { name: 'circular' };
      (circularError as Record<string, unknown>).self = circularError;

      const safeError = createSafeError(circularError);

      expect(safeError.message).toBe('Object error (not serializable)');
      expect(safeError.code).toBe('NON_SERIALIZABLE_ERROR');
    });

    it('기타 타입을 처리한다', () => {
      const symbolError = Symbol('error');
      const safeError = createSafeError(symbolError);

      expect(safeError.message).toContain('Symbol error: Symbol(error)');
      expect(safeError.code).toBe('SYMBOL_ERROR');
      expect(safeError.name).toBe('SymbolError');
    });
  });

  describe('classifyErrorType', () => {
    it('네트워크 에러를 분류한다', () => {
      const networkError = createSafeError('Network connection failed');
      expect(classifyErrorType(networkError)).toBe('NETWORK_ERROR');

      const fetchError = createSafeError('fetch request failed');
      expect(classifyErrorType(fetchError)).toBe('NETWORK_ERROR');
    });

    it('타임아웃 에러를 분류한다', () => {
      const timeoutError = createSafeError('Request timeout');
      expect(classifyErrorType(timeoutError)).toBe('TIMEOUT_ERROR');

      const koreanTimeout = createSafeError('요청 시간 초과');
      expect(classifyErrorType(koreanTimeout)).toBe('TIMEOUT_ERROR');
    });

    it('인증 에러를 분류한다', () => {
      const authError = createSafeError('401 Unauthorized');
      expect(classifyErrorType(authError)).toBe('AUTHENTICATION_ERROR');

      const koreanAuth = createSafeError('인증이 필요합니다');
      expect(classifyErrorType(koreanAuth)).toBe('AUTHENTICATION_ERROR');
    });

    it('권한 에러를 분류한다', () => {
      const permissionError = createSafeError('403 Forbidden');
      expect(classifyErrorType(permissionError)).toBe('PERMISSION_ERROR');

      const koreanPermission = createSafeError('권한이 없습니다');
      expect(classifyErrorType(koreanPermission)).toBe('PERMISSION_ERROR');
    });

    it('Not Found 에러를 분류한다', () => {
      const notFoundError = createSafeError('404 Not Found');
      expect(classifyErrorType(notFoundError)).toBe('NOT_FOUND_ERROR');

      const koreanNotFound = createSafeError('페이지를 찾을 수 없습니다');
      expect(classifyErrorType(koreanNotFound)).toBe('NOT_FOUND_ERROR');
    });

    it('서버 에러를 분류한다', () => {
      const serverError = createSafeError('500 Internal Server Error');
      expect(classifyErrorType(serverError)).toBe('SERVER_ERROR');

      const koreanServer = createSafeError('서버 오류가 발생했습니다');
      expect(classifyErrorType(koreanServer)).toBe('SERVER_ERROR');
    });

    it('검증 에러를 분류한다', () => {
      const validationError = createSafeError('Validation failed');
      expect(classifyErrorType(validationError)).toBe('VALIDATION_ERROR');

      const invalidError = createSafeError('Invalid input data');
      expect(classifyErrorType(invalidError)).toBe('VALIDATION_ERROR');
    });

    it('로딩 에러를 분류한다', () => {
      const loadingError = createSafeError('Loading failed');
      expect(classifyErrorType(loadingError)).toBe('LOADING_ERROR');

      const bootError = createSafeError('Boot process failed');
      expect(classifyErrorType(bootError)).toBe('LOADING_ERROR');
    });

    it('API 에러를 분류한다', () => {
      const apiError = createSafeError('API call failed');
      expect(classifyErrorType(apiError)).toBe('API_ERROR');

      const codeApiError = createSafeError('Unknown error');
      codeApiError.code = 'API_ERROR';
      expect(classifyErrorType(codeApiError)).toBe('API_ERROR');
    });

    it('알 수 없는 에러를 분류한다', () => {
      const unknownError = createSafeError('Some random error');
      expect(classifyErrorType(unknownError)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('safeErrorLog', () => {
    it('에러를 안전하게 로깅한다', () => {
      const error = new Error('Test error');
      const result = safeErrorLog('TEST', error);

      expect(logger.error).toHaveBeenCalledWith('TEST:', 'Test error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('↳ Type:'),
        expect.stringContaining('Code:')
      );
      expect(result.message).toBe('Test error');
    });

    it('스택 트레이스를 포함하여 로깅한다', () => {
      const error = new Error('Test error with stack');
      safeErrorLog('TEST', error, true);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('↳ Stack:'),
        expect.any(String)
      );
    });

    it('개발 환경에서 원본 에러를 출력한다', () => {
      vi.stubEnv('NODE_ENV', 'development');

      const error = new Error('Development error');
      safeErrorLog('DEV', error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('↳ Original:'),
        error
      );

      vi.unstubAllEnvs();
    });
  });

  describe('safeErrorMessage', () => {
    it('에러에서 안전하게 메시지를 추출한다', () => {
      const error = new Error('Test message');
      const message = safeErrorMessage(error);

      expect(message).toBe('Test message');
    });

    it('fallback 메시지를 사용한다', () => {
      const message = safeErrorMessage(null, 'Custom fallback');

      expect(message).toBe('Custom fallback');
    });

    it('기본 fallback 메시지를 사용한다', () => {
      const message = safeErrorMessage(undefined);

      expect(message).toBe('알 수 없는 오류가 발생했습니다');
    });
  });

  describe('Error classification helpers', () => {
    it('isLoadingRelatedError는 로딩 관련 에러를 감지한다', () => {
      expect(isLoadingRelatedError('Loading failed')).toBe(true);
      expect(isLoadingRelatedError('Boot error')).toBe(true);
      expect(isLoadingRelatedError('로딩 중 오류')).toBe(true);
      expect(isLoadingRelatedError('Random error')).toBe(false);
    });

    it('isTypeSafetyError는 타입 안전성 에러를 감지한다', () => {
      expect(isTypeSafetyError('Cannot read properties of undefined')).toBe(
        true
      );
      expect(isTypeSafetyError('TypeError: Cannot read property')).toBe(true);
      expect(isTypeSafetyError('is not a function')).toBe(true);
      expect(isTypeSafetyError('Network error')).toBe(false);
    });

    it('isAutoRecoverableError는 자동 복구 가능한 에러를 감지한다', () => {
      expect(isAutoRecoverableError('Network timeout')).toBe(true);
      expect(isAutoRecoverableError('Connection failed')).toBe(true);
      expect(isAutoRecoverableError('500 server error')).toBe(true);
      expect(isAutoRecoverableError('401 Unauthorized')).toBe(false);
      expect(isAutoRecoverableError('Validation failed')).toBe(false);
    });
  });

  describe('safeApiCall', () => {
    it('성공하는 API 호출을 처리한다', async () => {
      const successfulApi = vi.fn().mockResolvedValue('success data');

      const result = await safeApiCall(successfulApi, 'Test API');

      expect(result.success).toBe(true);
      expect(result.data).toBe('success data');
      expect(result.error).toBeUndefined();
    });

    it('실패하는 API 호출을 처리한다', async () => {
      const failingApi = vi.fn().mockRejectedValue(new Error('API failed'));

      const result = await safeApiCall(failingApi, 'Test API');

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error?.message).toBe('API failed');
    });

    it('fallback 값을 사용한다', async () => {
      const failingApi = vi.fn().mockRejectedValue(new Error('API failed'));
      const fallbackValue = 'fallback data';

      const result = await safeApiCall(failingApi, 'Test API', fallbackValue);

      expect(result.success).toBe(false);
      expect(result.data).toBe(fallbackValue);
    });
  });

  describe('withErrorRecovery', () => {
    it('성공하는 작업을 즉시 반환한다', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');

      const result = await withErrorRecovery(successOperation);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(successOperation).toHaveBeenCalledTimes(1);
    });

    it('실패하는 작업을 재시도한다', async () => {
      vi.useFakeTimers();

      const failingOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValue('success on attempt 3');

      const resultPromise = withErrorRecovery(failingOperation, {
        maxRetries: 3,
        retryDelay: 10,
      });

      // 재시도 지연 시간을 빠르게 진행
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success on attempt 3');
      expect(result.attempts).toBe(3);
      expect(failingOperation).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('최대 재시도 횟수에 도달하면 실패한다', async () => {
      vi.useFakeTimers();

      const alwaysFailingOperation = vi
        .fn()
        .mockRejectedValue(new Error('Always fails'));

      const resultPromise = withErrorRecovery(alwaysFailingOperation, {
        maxRetries: 2,
        retryDelay: 10,
      });

      // 재시도 지연 시간을 빠르게 진행
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Always fails');
      expect(result.attempts).toBe(2);
      expect(alwaysFailingOperation).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('재시도 콜백을 호출한다', async () => {
      vi.useFakeTimers();

      const onRetry = vi.fn();
      const failingOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success');

      const resultPromise = withErrorRecovery(failingOperation, {
        maxRetries: 2,
        retryDelay: 10,
        onRetry,
      });

      // 재시도 지연 시간을 빠르게 진행
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Object));

      vi.useRealTimers();
    });

    it('shouldRetry 조건을 확인한다', async () => {
      const shouldRetry = vi.fn().mockReturnValue(false);
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error('Should not retry'));

      const result = await withErrorRecovery(failingOperation, {
        maxRetries: 3,
        shouldRetry,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Object));
      expect(failingOperation).toHaveBeenCalledTimes(1);
    });

    it('fallback 값을 반환한다', async () => {
      vi.useFakeTimers();

      const failingOperation = vi.fn().mockRejectedValue(new Error('Failed'));
      const fallbackValue = 'fallback';

      const resultPromise = withErrorRecovery(failingOperation, {
        maxRetries: 1,
        fallbackValue,
      });

      // 재시도 지연 시간을 빠르게 진행
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toMatchObject({
        success: false,
        data: fallbackValue,
      });

      vi.useRealTimers();
    });
  });

  describe('createErrorBoundaryInfo', () => {
    it('에러 바운더리 정보를 생성한다', () => {
      const error = new Error('Component error');
      const errorInfo = { componentStack: 'Component stack trace' };

      const boundaryInfo = createErrorBoundaryInfo(error, errorInfo);

      expect(boundaryInfo).toHaveProperty('error');
      expect(boundaryInfo).toHaveProperty('timestamp');
      expect(boundaryInfo.error.message).toBe('Component error');
    });

    it('errorInfo 없이도 동작한다', () => {
      const error = new Error('Simple error');

      const boundaryInfo = createErrorBoundaryInfo(error);

      expect(boundaryInfo.error.message).toBe('Simple error');
    });
  });
});
