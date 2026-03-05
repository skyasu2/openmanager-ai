import { describe, expect, it } from 'vitest';
import { classifyErrorType, createSafeError } from './error-handler-core';

describe('createSafeError', () => {
  it('should handle null', () => {
    const result = createSafeError(null);
    expect(result.message).toBe('Unknown error (null/undefined)');
    expect(result.code).toBe('NULL_ERROR');
    expect(result.name).toBe('NullError');
    expect(result.originalError).toBeNull();
  });

  it('should handle undefined', () => {
    const result = createSafeError(undefined);
    expect(result.message).toBe('Unknown error (null/undefined)');
    expect(result.code).toBe('NULL_ERROR');
    expect(result.name).toBe('NullError');
    expect(result.originalError).toBeUndefined();
  });

  it('should handle Error instance and preserve message, stack, name', () => {
    const error = new TypeError('something broke');
    const result = createSafeError(error);
    expect(result.message).toBe('something broke');
    expect(result.stack).toBeDefined();
    expect(result.name).toBe('TypeError');
    expect(result.code).toBe('TypeError');
    expect(result.originalError).toBe(error);
  });

  it('should handle Error instance with empty message', () => {
    const error = new Error('');
    const result = createSafeError(error);
    expect(result.message).toBe('Error without message');
  });

  it('should handle string error', () => {
    const result = createSafeError('something went wrong');
    expect(result.message).toBe('something went wrong');
    expect(result.code).toBe('STRING_ERROR');
    expect(result.name).toBe('StringError');
  });

  it('should handle empty string error', () => {
    const result = createSafeError('');
    expect(result.message).toBe('Empty error message');
    expect(result.code).toBe('STRING_ERROR');
    expect(result.name).toBe('StringError');
  });

  it('should handle number error', () => {
    const result = createSafeError(404);
    expect(result.message).toBe('Error code: 404');
    expect(result.code).toBe('404');
    expect(result.name).toBe('NumberError');
  });

  it('should handle object with message string', () => {
    const result = createSafeError({ message: 'custom error', code: 'CUSTOM' });
    expect(result.message).toBe('custom error');
    expect(result.code).toBe('CUSTOM');
    expect(result.name).toBe('ObjectError');
    expect(result.details).toEqual({ message: 'custom error', code: 'CUSTOM' });
  });

  it('should handle object with message and name', () => {
    const result = createSafeError({ message: 'named error', name: 'MyError' });
    expect(result.message).toBe('named error');
    expect(result.name).toBe('MyError');
    expect(result.code).toBe('MyError');
  });

  it('should handle object without message via JSON.stringify', () => {
    const result = createSafeError({ foo: 'bar', count: 42 });
    expect(result.message).toContain('Object error:');
    expect(result.message).toContain('"foo":"bar"');
    expect(result.code).toBe('OBJECT_ERROR');
    expect(result.name).toBe('ObjectError');
  });

  it('should handle non-serializable object (circular ref)', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const result = createSafeError(circular);
    expect(result.message).toBe('Object error (not serializable)');
    expect(result.code).toBe('NON_SERIALIZABLE_ERROR');
    expect(result.name).toBe('NonSerializableError');
  });

  it('should handle symbol', () => {
    const sym = Symbol('test-symbol');
    const result = createSafeError(sym);
    expect(result.message).toBe('Symbol error: Symbol(test-symbol)');
    expect(result.code).toBe('SYMBOL_ERROR');
    expect(result.name).toBe('SymbolError');
  });

  it('should handle object with non-string message', () => {
    const result = createSafeError({ message: 123 });
    expect(result.message).toBe('123');
    expect(result.code).toBe('ObjectError');
  });

  it('should handle object with empty string message', () => {
    const result = createSafeError({ message: '' });
    expect(result.message).toBe('Object error without message');
  });
});

describe('classifyErrorType', () => {
  it('should classify "network error" as NETWORK_ERROR', () => {
    expect(classifyErrorType({ message: 'network error occurred' })).toBe('NETWORK_ERROR');
  });

  it('should classify "fetch failed" as NETWORK_ERROR', () => {
    expect(classifyErrorType({ message: 'fetch failed' })).toBe('NETWORK_ERROR');
  });

  it('should classify "connection refused" as NETWORK_ERROR', () => {
    expect(classifyErrorType({ message: 'connection refused' })).toBe('NETWORK_ERROR');
  });

  it('should classify "timeout" as TIMEOUT_ERROR', () => {
    expect(classifyErrorType({ message: 'request timeout' })).toBe('TIMEOUT_ERROR');
  });

  it('should classify Korean "시간 초과" as TIMEOUT_ERROR', () => {
    expect(classifyErrorType({ message: '요청 시간 초과' })).toBe('TIMEOUT_ERROR');
  });

  it('should classify "401 unauthorized" as AUTHENTICATION_ERROR', () => {
    expect(classifyErrorType({ message: '401 unauthorized' })).toBe('AUTHENTICATION_ERROR');
  });

  it('should classify Korean "인증 실패" as AUTHENTICATION_ERROR', () => {
    expect(classifyErrorType({ message: '인증 실패' })).toBe('AUTHENTICATION_ERROR');
  });

  it('should classify "403 forbidden" as PERMISSION_ERROR', () => {
    expect(classifyErrorType({ message: '403 forbidden' })).toBe('PERMISSION_ERROR');
  });

  it('should classify Korean "권한 없음" as PERMISSION_ERROR', () => {
    expect(classifyErrorType({ message: '권한 없음' })).toBe('PERMISSION_ERROR');
  });

  it('should classify "404 not found" as NOT_FOUND_ERROR', () => {
    expect(classifyErrorType({ message: '404 not found' })).toBe('NOT_FOUND_ERROR');
  });

  it('should classify "500 server error" as SERVER_ERROR', () => {
    expect(classifyErrorType({ message: '500 server error' })).toBe('SERVER_ERROR');
  });

  it('should classify "validation failed" as VALIDATION_ERROR', () => {
    expect(classifyErrorType({ message: 'validation failed' })).toBe('VALIDATION_ERROR');
  });

  it('should classify "invalid input" as VALIDATION_ERROR', () => {
    expect(classifyErrorType({ message: 'invalid input data' })).toBe('VALIDATION_ERROR');
  });

  it('should classify "loading failed" as LOADING_ERROR', () => {
    expect(classifyErrorType({ message: 'loading failed' })).toBe('LOADING_ERROR');
  });

  it('should classify "api call error" as API_ERROR', () => {
    expect(classifyErrorType({ message: 'api call error' })).toBe('API_ERROR');
  });

  it('should classify by code containing API as API_ERROR', () => {
    expect(classifyErrorType({ message: 'something happened', code: 'API_FAILURE' })).toBe('API_ERROR');
  });

  it('should classify unknown message as UNKNOWN_ERROR', () => {
    expect(classifyErrorType({ message: 'something random' })).toBe('UNKNOWN_ERROR');
  });
});
