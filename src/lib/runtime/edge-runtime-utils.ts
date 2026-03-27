/**
 * 🚀 Edge Runtime 전용 유틸리티 라이브러리
 * winston, ioredis 등 Node.js 모듈 대체
 */

// Edge Runtime 호환 로거
import { logger } from '@/lib/logging';
export class EdgeLogger {
  private static instance: EdgeLogger;
  private logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    meta?: unknown;
  }> = [];
  private maxLogs = 100;

  static getInstance(): EdgeLogger {
    if (!EdgeLogger.instance) {
      EdgeLogger.instance = new EdgeLogger();
    }
    return EdgeLogger.instance;
  }

  private log(level: string, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, meta };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // 오래된 로그 제거
    }

    // 콘솔 출력
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (meta) {
      logger.info(logMessage, meta);
    } else {
      logger.info(logMessage);
    }
  }

  info(message: string, meta?: unknown) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: unknown) {
    this.log('debug', message, meta);
  }

  getLogs() {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

// Edge Runtime 호환 캐시
export class EdgeCache {
  private static instance: EdgeCache;
  private cache = new Map<string, { value: unknown; expires: number }>();
  private maxSize = 100;

  static getInstance(): EdgeCache {
    if (!EdgeCache.instance) {
      EdgeCache.instance = new EdgeCache();
    }
    return EdgeCache.instance;
  }

  set(key: string, value: unknown, ttlMs = 300000): void {
    // 기본 5분
    const expires = Date.now() + ttlMs;

    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, expires });
  }

  get(key: string): unknown | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    // 만료된 항목들 정리
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.size(),
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Edge Runtime 호환 HTTP 클라이언트
export const EdgeHTTPClient = {
  baseConfig: {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  },

  async get<T>(url: string, config: RequestInit = {}): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  },

  async post<T>(
    url: string,
    data: unknown,
    config: RequestInit = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async request<T>(url: string, config: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.baseConfig.timeout);

    try {
      const response = await fetch(url, {
        ...this.baseConfig,
        ...config,
        signal: controller.signal,
        headers: {
          ...this.baseConfig.headers,
          ...config.headers,
        },
      });

      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  },
};

// Edge Runtime 호환 상태 관리자
export class EdgeStateManager {
  private static instance: EdgeStateManager;
  private state = new Map<string, unknown>();

  static getInstance(): EdgeStateManager {
    if (!EdgeStateManager.instance) {
      EdgeStateManager.instance = new EdgeStateManager();
    }
    return EdgeStateManager.instance;
  }

  setState(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  getState(key: string): unknown {
    return this.state.get(key);
  }

  removeState(key: string): void {
    this.state.delete(key);
  }

  clearState(): void {
    this.state.clear();
  }

  getAllState(): Record<string, unknown> {
    return Object.fromEntries(this.state);
  }
}

// Edge Runtime 환경 감지
export function isEdgeRuntime(): boolean {
  // Vercel Edge Runtime 환경 감지
  return (
    (typeof globalThis !== 'undefined' &&
      (globalThis as { EdgeRuntime?: string }).EdgeRuntime === 'vercel') ||
    (typeof process !== 'undefined' &&
      process.env.VERCEL_ENV !== undefined &&
      typeof window === 'undefined')
  );
}

// Edge Runtime 호환 검사 (정적 검사로 변경)
export function checkEdgeCompatibility() {
  const isEdge = isEdgeRuntime();
  const hasWindow = typeof window !== 'undefined';
  const hasProcess = typeof process !== 'undefined';
  const hasGlobal = typeof global !== 'undefined';
  const hasBuffer = typeof Buffer !== 'undefined';

  // Edge Runtime에서 사용 가능한 기능들
  const edgeFeatures = {
    fetch: typeof fetch !== 'undefined',
    crypto:
      typeof crypto !== 'undefined' ||
      (typeof globalThis !== 'undefined' && globalThis.crypto),
    performance: typeof performance !== 'undefined',
    console: typeof console !== 'undefined',
    URL: typeof URL !== 'undefined',
    URLSearchParams: typeof URLSearchParams !== 'undefined',
    TextEncoder: typeof TextEncoder !== 'undefined',
    TextDecoder: typeof TextDecoder !== 'undefined',
    AbortController: typeof AbortController !== 'undefined',
    ReadableStream: typeof ReadableStream !== 'undefined',
    WritableStream: typeof WritableStream !== 'undefined',
    TransformStream: typeof TransformStream !== 'undefined',
  };

  // 환경 정보
  const environment = {
    isEdge,
    hasWindow,
    hasProcess,
    hasGlobal,
    hasBuffer,
    userAgent: hasWindow
      ? (window as { navigator?: { userAgent?: string } }).navigator?.userAgent
      : undefined,
    nodeVersion: hasProcess ? process.version : undefined,
    platform: hasProcess ? process.platform : undefined,
  };

  return {
    isEdge,
    environment,
    edgeFeatures,
    compatible: isEdge ? Object.values(edgeFeatures).every(Boolean) : true,
  };
}

// Edge Runtime 성능 모니터링
export class EdgePerformanceMonitor {
  private static instance: EdgePerformanceMonitor;
  private metrics = new Map<string, number[]>();

  static getInstance(): EdgePerformanceMonitor {
    if (!EdgePerformanceMonitor.instance) {
      EdgePerformanceMonitor.instance = new EdgePerformanceMonitor();
    }
    return EdgePerformanceMonitor.instance;
  }

  startTimer(name: string): () => number {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      return duration;
    };
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name);
    if (values) {
      values.push(value);

      // 최대 100개의 측정값만 유지
      if (values.length > 100) {
        values.shift();
      }
    }
  }

  getMetrics(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getAllMetrics() {
    const result: Record<string, unknown> = {};
    const entries = Array.from(this.metrics.entries());
    for (const [name] of entries) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// 통합 Edge Runtime 서비스
export class EdgeRuntimeService {
  public logger = EdgeLogger.getInstance();
  public cache = EdgeCache.getInstance();
  public state = EdgeStateManager.getInstance();
  public performance = EdgePerformanceMonitor.getInstance();
  public http = EdgeHTTPClient;

  constructor() {
    this.logger.debug('Edge Runtime Service 초기화됨');
  }

  // 호환성 체크
  checkCompatibility() {
    return checkEdgeCompatibility();
  }

  // 시스템 상태
  getSystemStatus() {
    return {
      runtime: isEdgeRuntime() ? 'edge' : 'node',
      compatibility: this.checkCompatibility(),
      cache: this.cache.getStats(),
      metrics: this.performance.getAllMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  // 정리 작업
  cleanup() {
    this.cache.clear();
    this.state.clearState();
    this.performance.clearMetrics();
    this.logger.clearLogs();
    this.logger.info('Edge Runtime Service 정리 완료');
  }
}

// 싱글톤 인스턴스 내보내기
const _edgeRuntimeService = new EdgeRuntimeService();
