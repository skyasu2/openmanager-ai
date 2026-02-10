/**
 * 🎯 any 타입 대체를 위한 공통 타입 정의
 *
 * Phase 2: 확장된 타입 시스템으로 any 타입 완전 제거
 */

import type { ReactNode } from 'react';

// ===== 기본 타입 =====

// 기본 객체 타입
export type AnyObject = Record<string, unknown>;
export type StringRecord = Record<string, string>;
export type NumberRecord = Record<string, number>;
export type BooleanRecord = Record<string, boolean>;

// 함수 타입
export type AnyFunction = (...args: unknown[]) => unknown;
export type AsyncAnyFunction = (...args: unknown[]) => Promise<unknown>;
export type VoidFunction = () => void;
export type AsyncVoidFunction = () => Promise<void>;
export type EventHandler<T = unknown> = (event: T) => void;
export type AsyncEventHandler<T = unknown> = (event: T) => Promise<void>;

// 배열 타입
export type AnyArray = unknown[];
export type StringArray = string[];
export type NumberArray = number[];
export type ObjectArray<T = unknown> = T[];

// 에러 타입
export type UnknownError = unknown;
export type ErrorWithMessage = Error | { message: string };
export type ErrorWithCode = ErrorWithMessage & { code?: string | number };
export type ApiError = ErrorWithCode & { statusCode?: number };

// ===== API 관련 타입 =====

// API 응답 타입
export interface ApiResponseData {
  [key: string]: unknown;
}

export interface ApiRequestData {
  [key: string]: unknown;
}

export interface ApiHeaders {
  [key: string]: string | string[] | undefined;
}

export interface ApiQueryParams {
  [key: string]: string | string[] | undefined;
}

// ===== 설정 관련 타입 =====

// 설정 타입
export interface ConfigObject {
  [key: string]: string | number | boolean | ConfigObject | undefined;
}

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  [key: string]: string | undefined;
}

export interface FeatureFlags {
  [key: string]: boolean;
}

// ===== 서버 관련 타입 =====

// 서버 관련 타입
export interface ServerMetadata {
  [key: string]: string | number | boolean | undefined;
}

export interface GenericServerMetrics {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: {
    in?: number;
    out?: number;
  };
  [key: string]: unknown;
}

/** @deprecated Use GenericServerMetrics */
export type ServerMetrics = GenericServerMetrics;

export interface ServerEvent {
  type: string;
  timestamp: string;
  data?: unknown;
  [key: string]: unknown;
}

// ===== 데이터 분석 타입 =====

// 진단 정보 타입
export interface DiagnosticsData {
  [key: string]: unknown;
}

// 분석 데이터 타입
export interface AnalysisData {
  metrics?: Record<string, number>;
  status?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

// ===== React/Next.js 관련 타입 =====

export type ReactChildren = ReactNode;
export type ReactProps<T = unknown> = T & { children?: ReactNode };
export type NextPageProps<T = unknown> = T & {
  params?: Record<string, string>;
  searchParams?: Record<string, string | string[]>;
};

// ===== 유틸리티 타입 =====

// JSON 타입
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// 깊은 부분 타입
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// 읽기 전용 깊은 타입
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

// Nullable 타입
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// ===== 데이터베이스 관련 타입 =====

export interface DatabaseRecord {
  id: string | number;
  createdAt: string | Date;
  updatedAt: string | Date;
  [key: string]: unknown;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  command?: string;
}

// ===== 이벤트 관련 타입 =====

export interface EventPayload<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  id?: string;
}

// ===== 캐시 관련 타입 =====

export interface CacheEntry<T = unknown> {
  data: T;
  ttl?: number;
  createdAt: number;
  tags?: string[];
}

// ===== 모니터링 관련 타입 =====

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface LogEntry {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// 타입 가드 함수들
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

// 안전한 타입 변환 함수들
export function toSafeObject(value: unknown): AnyObject {
  if (isRecord(value)) {
    return value;
  }
  return {};
}

export function toSafeArray(value: unknown): AnyArray {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

export function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // For objects and arrays, use String() to get standard JavaScript string representation
  return String(value);
}
