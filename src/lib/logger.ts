/**
 * 🔍 개발용 로거 시스템
 * 테스트용 console.log를 대체하는 구조화된 로깅
 */

import type { SafeError } from './types/error-types';

/**
 * 안전한 에러 객체 생성
 */
function createSafeError(
  error: unknown,
  fallbackMessage = 'Unknown error'
): SafeError {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      stack: error.stack,
      name: error.name,
      originalError: error,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error || fallbackMessage,
      originalError: error,
    };
  }

  return {
    message: fallbackMessage,
    originalError: error,
  };
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class DevLogger {
  private static instance: DevLogger;
  private logLevel: LogLevel;
  private enabledCategories: Set<string>;

  private constructor() {
    this.logLevel =
      process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.ERROR;
    this.enabledCategories = new Set([
      'test',
      'ai',
      'api',
      'performance',
      'error',
      'cache',
      'system',
      'general',
    ]);
  }

  static getInstance(): DevLogger {
    if (!DevLogger.instance) {
      DevLogger.instance = new DevLogger();
    }
    return DevLogger.instance;
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    return level >= this.logLevel && this.enabledCategories.has(category);
  }

  private formatMessage(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
    error?: SafeError
  ): string {
    const timestamp = new Date().toISOString();
    const levelIcon = this.getLevelIcon(level);
    const categoryIcon = this.getCategoryIcon(category);

    let formatted = `${timestamp} ${levelIcon} ${categoryIcon} [${category.toUpperCase()}] ${message}`;

    if (data) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    if (error) {
      formatted += `\nError: ${error.message}`;
      if (error.stack) {
        formatted += `\nStack: ${error.stack}`;
      }
      if (error.code) {
        formatted += `\nCode: ${error.code}`;
      }
    }

    return formatted;
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '📝';
    }
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      test: '🧪',
      ai: '🤖',
      api: '🔗',
      performance: '⚡',
      error: '🚨',
      database: '💾',
      auth: '🔐',
      cache: '📦',
    };
    return icons[category] || '📝';
  }

  debug(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG, category)) {
      console.debug(
        this.formatMessage(LogLevel.DEBUG, category, message, data)
      );
    }
  }

  info(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO, category)) {
      console.info(this.formatMessage(LogLevel.INFO, category, message, data));
    }
  }

  warn(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN, category)) {
      console.warn(this.formatMessage(LogLevel.WARN, category, message, data));
    }
  }

  error(
    category: string,
    message: string,
    data?: unknown,
    errorObj?: unknown
  ): void {
    if (this.shouldLog(LogLevel.ERROR, category)) {
      const safeError = errorObj ? createSafeError(errorObj) : undefined;

      console.error(
        this.formatMessage(LogLevel.ERROR, category, message, data, safeError)
      );
    }
  }

  // 테스트 전용 메서드들
  testStart(testName: string, description?: string): void {
    this.info('test', `테스트 시작: ${testName}`, { description });
  }

  testEnd(testName: string, success: boolean, duration?: number): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `테스트 ${success ? '성공' : '실패'}: ${testName}`;
    const data = duration ? { duration: `${duration}ms` } : undefined;

    if (level === LogLevel.ERROR) {
      this.error('test', message, data);
    } else {
      this.info('test', message, data);
    }
  }

  testResult(testName: string, expected: unknown, actual: unknown): void {
    const success = JSON.stringify(expected) === JSON.stringify(actual);
    this.testEnd(testName, success);

    if (!success) {
      this.error('test', `테스트 실패 상세`, {
        testName,
        expected,
        actual,
      });
    }
  }

  // 성능 측정
  performance(operation: string, duration: number, metadata?: unknown): void {
    this.info('performance', `${operation}: ${duration}ms`, metadata);
  }

  // 에러 로깅 함수들
  errorTrace(category: string, message: string, error: unknown): void {
    const safeError = createSafeError(error);
    this.error(
      category,
      message,
      { errorDetails: safeError.message },
      safeError
    );
  }

  errorWithStack(category: string, message: string, error: unknown): void {
    const safeError = createSafeError(error);
    this.error(category, message, {}, safeError);
  }

  warnWithDetails(
    category: string,
    message: string,
    details?: unknown,
    error?: unknown
  ): void {
    const safeError = error ? createSafeError(error) : undefined;
    this.warn(category, message, { details, error: safeError?.message });
  }

  // AI 관련 로깅
  aiQuery(query: string, engine: string, confidence?: number): void {
    this.info('ai', `AI 쿼리 처리`, {
      query: query.substring(0, 100),
      engine,
      confidence,
    });
  }

  aiResponse(response: string, processingTime: number): void {
    this.info('ai', `AI 응답 생성`, {
      responseLength: response.length,
      processingTime: `${processingTime}ms`,
    });
  }
}

// 싱글톤 인스턴스 export
export const devLogger = DevLogger.getInstance();

// 편의 함수들
const _logTest = (name: string, description?: string) =>
  devLogger.testStart(name, description);
const _logTestResult = (name: string, success: boolean, duration?: number) =>
  devLogger.testEnd(name, success, duration);
const _logPerformance = (
  operation: string,
  duration: number,
  metadata?: unknown
) => devLogger.performance(operation, duration, metadata);
const _logAI = (query: string, engine: string, confidence?: number) =>
  devLogger.aiQuery(query, engine, confidence);

// 에러 관련 편의 함수
const _logError = (
  message: string,
  error: unknown,
  category: string = 'general'
) => devLogger.errorTrace(category, message, error);

const _logErrorWithStack = (
  message: string,
  error: unknown,
  category: string = 'general'
) => devLogger.errorWithStack(category, message, error);

const _logWarningWithDetails = (
  message: string,
  details?: unknown,
  error?: unknown,
  category: string = 'general'
) => devLogger.warnWithDetails(category, message, details, error);

// 🔄 기존 코드 호환성을 위한 레거시 export
export const systemLogger = {
  info: (message: string, data?: unknown) =>
    devLogger.info('system', message, data),
  warn: (message: string, data?: unknown) =>
    devLogger.warn('system', message, data),
  error: (message: string, data?: unknown) =>
    devLogger.error('system', message, data),
  debug: (message: string, data?: unknown) =>
    devLogger.debug('system', message, data),
  system: (message: string, data?: unknown) =>
    devLogger.info('system', message, data),
  ai: (message: string, data?: unknown) => devLogger.info('ai', message, data),
};

const _logger = {
  info: (message: string, data?: unknown) =>
    devLogger.info('general', message, data),
  warn: (message: string, data?: unknown) =>
    devLogger.warn('general', message, data),
  error: (message: string, data?: unknown) =>
    devLogger.error('general', message, data),
  debug: (message: string, data?: unknown) =>
    devLogger.debug('general', message, data),
};

const _apiLogger = {
  info: (message: string, data?: unknown) =>
    devLogger.info('api', message, data),
  warn: (message: string, data?: unknown) =>
    devLogger.warn('api', message, data),
  error: (message: string, data?: unknown) =>
    devLogger.error('api', message, data),
  debug: (message: string, data?: unknown) =>
    devLogger.debug('api', message, data),
};

export const aiLogger = {
  info: (message: string, data?: unknown) =>
    devLogger.info('ai', message, data),
  warn: (message: string, data?: unknown) =>
    devLogger.warn('ai', message, data),
  error: (message: string, data?: unknown) =>
    devLogger.error('ai', message, data),
  debug: (message: string, data?: unknown) =>
    devLogger.debug('ai', message, data),
};

// 기본 export
