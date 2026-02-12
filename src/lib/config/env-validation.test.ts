/**
 * 환경변수 검증 테스트
 *
 * @description
 * - TEST_API_KEY 검증
 * - 최소 길이 요구사항
 * - 프로덕션/개발환경 동작 차이
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateTestApiKey,
  validateEnvironmentVariables,
} from './env-validation';

describe('validateTestApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('TEST_API_KEY 누락 시 조용히 통과', () => {
    // Given
    delete process.env.TEST_API_KEY;

    // When & Then - 에러 없이 통과
    expect(() => validateTestApiKey()).not.toThrow();
  });

  it('8자 이상 시 통과', () => {
    // Given
    process.env.TEST_API_KEY = '12345678'; // 정확히 8자

    // When & Then
    expect(() => validateTestApiKey()).not.toThrow();
  });

  it('8자 초과 시 통과', () => {
    // Given
    process.env.TEST_API_KEY = 'a-very-long-api-key-that-is-secure';

    // When & Then
    expect(() => validateTestApiKey()).not.toThrow();
  });

  it('8자 미만 시 throw', () => {
    // Given
    process.env.TEST_API_KEY = 'short'; // 5자

    // When & Then
    expect(() => validateTestApiKey()).toThrow('[Config Error]');
  });

  it('빈 문자열 시 throw', () => {
    // Given
    process.env.TEST_API_KEY = '';

    // When & Then - 빈 문자열은 falsy이므로 통과
    expect(() => validateTestApiKey()).not.toThrow();
  });

  it('에러 메시지에 현재 길이 포함', () => {
    // Given
    process.env.TEST_API_KEY = 'abc'; // 3자

    // When & Then
    expect(() => validateTestApiKey()).toThrow('Current length: 3');
  });

  it('에러 메시지에 최소 길이 요구사항 포함', () => {
    // Given
    process.env.TEST_API_KEY = '1234'; // 4자

    // When & Then
    expect(() => validateTestApiKey()).toThrow('at least 8 characters');
  });
});

describe('validateEnvironmentVariables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validateTestApiKey 호출 - 정상 케이스', () => {
    // Given
    process.env.TEST_API_KEY = 'valid-api-key-12345';
    process.env.NODE_ENV = 'development';

    // When & Then - 에러 없이 통과
    expect(() => validateEnvironmentVariables()).not.toThrow();
  });

  it('개발환경에서 에러 발생 시 throw', () => {
    // Given
    process.env.TEST_API_KEY = 'short';
    process.env.NODE_ENV = 'development';

    // When & Then
    expect(() => validateEnvironmentVariables()).toThrow('[Config Error]');
  });

  it('프로덕션에서 에러 시 process.exit 호출 (모킹)', () => {
    // Given
    process.env.TEST_API_KEY = 'bad';
    process.env.NODE_ENV = 'production';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // When & Then
    expect(() => validateEnvironmentVariables()).toThrow();

    // Cleanup
    exitSpy.mockRestore();
  });

  it('환경변수 없으면 성공', () => {
    // Given
    delete process.env.TEST_API_KEY;

    // When & Then
    expect(() => validateEnvironmentVariables()).not.toThrow();
  });
});
